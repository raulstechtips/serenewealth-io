from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.db.models import Count, Sum, Q, Max, Prefetch
from django.db import transaction
from datetime import datetime, timedelta
from decimal import Decimal

from ledger.models import Account, LedgerEntry, Category, CategoryType
from ledger.serializers import (
    AccountListSerializer,
    AccountSerializer,
    AccountFinancialSummarySerializer,
    AccountHealthSerializer,
    AccountActivitySerializer,
    AccountDashboardSerializer
)
from ledger.services.balance import AccountBalanceService


class AccountViewSet(viewsets.ModelViewSet):
    """
    Optimized AccountViewSet for financial app with specialized endpoints.
    
    Provides:
    - Fast list view with minimal queries
    - Basic account details
    - Specialized financial endpoints for rich data
    """
    queryset = Account.objects.all()
    serializer_class = AccountSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['type', 'subtype', 'currency']
    search_fields = ['name']
    ordering_fields = ['name', 'type', 'subtype', 'cached_actual_balance']
    ordering = ['name']
    
    def get_queryset(self):
        """Strategic optimization based on action."""
        queryset = Account.objects.filter(user=self.request.user)
        
        if self.action == 'list':
            # FAST: Only basic fields + lightweight annotations
            queryset = queryset.annotate(
                entries_count=Count('entries'),
                last_transaction_date=Max('entries__effective_date'),
                unmatched_count=Count('entries', filter=Q(entries__is_matched=False))
            ).order_by('name')
            
        elif self.action == 'retrieve':
            # MEDIUM: Basic account data with minimal related data
            queryset = queryset.select_related().prefetch_related(
                Prefetch('entries', 
                    queryset=LedgerEntry.objects.order_by('-effective_date')[:1], 
                    to_attr='latest_entry')
            )
            
        return queryset
    
    def get_serializer_class(self):
        """Smart serializer selection based on action."""
        if self.action == 'list':
            return AccountListSerializer  # Lightweight
        elif self.action == 'financial_summary':
            return AccountFinancialSummarySerializer
        elif self.action == 'health':
            return AccountHealthSerializer
        elif self.action == 'activity':
            return AccountActivitySerializer
        elif self.action == 'dashboard':
            return AccountDashboardSerializer
        return AccountSerializer  # Standard
    
    def get_or_create_opening_balance_category(self):
        """
        Get or create the 'Opening Balance' category for the user.
        This is used for opening balance ledger entries.
        """
        category, created = Category.objects.get_or_create(
            user=self.request.user,
            name="Opening Balance",
            defaults={
                'type': CategoryType.TRANSFER,
            }
        )
        return category

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        """
        Create account with optional opening balance.
        If opening_balance is provided and non-zero, creates an opening balance ledger entry.
        """
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # Extract opening balance before creating account
        opening_balance = serializer.validated_data.pop('opening_balance', Decimal('0.00'))
        
        # Set the user for the account
        serializer.validated_data['user'] = request.user
        
        # Create the account
        account = serializer.save()
        
        # Create opening balance ledger entry if needed
        if opening_balance != Decimal('0.00'):
            opening_balance_category = self.get_or_create_opening_balance_category()
            
            # For opening balances, interpret user input in a user-friendly way
            # LIABILITY: User enters positive = "I owe money", so flip to negative raw_amount
            # ASSET: User input is direct (positive = "I have money")
            if account.type == 'LIABILITY':
                adjusted_raw_amount = -opening_balance
            else:
                adjusted_raw_amount = opening_balance
            
            # Create opening balance entry with today's date
            LedgerEntry.objects.create(
                account=account,
                effective_date=datetime.now().date(),
                raw_amount=adjusted_raw_amount,
                signed_amount=LedgerEntry.normalize_signed_amount(account, adjusted_raw_amount),
                description="Opening Balance",
                category=opening_balance_category
            )
            # The balance update will be handled automatically by the LedgerEntry.save() method
        
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
    
    @action(detail=True, methods=['get'])
    def financial_summary(self, request, pk=None):
        """GET /accounts/{id}/financial_summary/ - Optimized financial metrics in single query."""
        account = self.get_object()
        
        # Single optimized query with all needed aggregations
        thirty_days_ago = datetime.now().date() - timedelta(days=30)
        
        # Build dynamic filters based on account type
        if account.type == 'ASSET':
            income_filter = Q(effective_date__gte=thirty_days_ago, signed_amount__gt=0)
            expense_filter = Q(effective_date__gte=thirty_days_ago, signed_amount__lt=0)
        else:  # LIABILITY
            income_filter = Q(effective_date__gte=thirty_days_ago, signed_amount__lt=0)
            expense_filter = Q(effective_date__gte=thirty_days_ago, signed_amount__gt=0)
        
        summary_data = account.entries.aggregate(
            total_entries=Count('id'),
            recent_entries_30d=Count('id', filter=Q(effective_date__gte=thirty_days_ago)),
            recent_income_30d=Sum('signed_amount', filter=income_filter),
            recent_expenses_30d=Sum('signed_amount', filter=expense_filter),
            recent_transfers_30d=Count('id', filter=Q(
                effective_date__gte=thirty_days_ago
            ) & (Q(transfer_from__isnull=False) | Q(transfer_to__isnull=False))),
            unmatched_entries=Count('id', filter=Q(is_matched=False)),
            last_transaction_date=Max('effective_date')
        )
        
        # Calculate net flow - handle None values from Sum aggregation
        income = abs(summary_data['recent_income_30d'] or Decimal('0'))
        expenses = abs(summary_data['recent_expenses_30d'] or Decimal('0'))
        net_flow = income - expenses
        
        response_data = {
            'account_id': str(account.id),
            'account_name': account.name,
            'account_type': account.type,
            'current_balance': str(account.cached_actual_balance),
            'summary': {
                'total_entries': summary_data['total_entries'],
                'recent_entries_30d': summary_data['recent_entries_30d'],
                'recent_income_30d': str(income),
                'recent_expenses_30d': str(expenses),
                'recent_transfers_30d': summary_data['recent_transfers_30d'],
                'unmatched_entries': summary_data['unmatched_entries'],
                'last_transaction_date': summary_data['last_transaction_date'],
                'net_flow_30d': str(net_flow)
            }
        }
        
        return Response(response_data)
    
    @action(detail=True, methods=['get'])
    def health(self, request, pk=None):
        """GET /accounts/{id}/health/ - Account health indicators."""
        account = self.get_object()
        
        health = {
            'status': 'healthy',
            'warnings': [],
            'balance_trend': 'stable',
        }
        
        current_balance = account.cached_actual_balance
        
        # Credit utilization for credit accounts
        if account.subtype == 'CREDIT' and account.credit_limit:
            utilization = abs(current_balance) / account.credit_limit
            if utilization > 0.7:
                health['warnings'].append('high_credit_utilization')
                health['status'] = 'critical'
            elif utilization > 0.3:
                health['warnings'].append('moderate_credit_utilization')
                if health['status'] == 'healthy':
                    health['status'] = 'warning'
            health['credit_utilization'] = f"{utilization:.2%}"
        
        # Negative balance check for assets
        if account.type == 'ASSET' and current_balance < 0:
            health['warnings'].append('negative_balance')
            if health['status'] == 'healthy':
                health['status'] = 'warning'
        
        # Recent activity and balance trend
        thirty_days_ago = datetime.now().date() - timedelta(days=30)
        seven_days_ago = datetime.now().date() - timedelta(days=7)
        
        # Check for recent activity
        recent_activity_exists = account.entries.filter(
            effective_date__gte=thirty_days_ago
        ).exists()
        
        if not recent_activity_exists and account.type == 'ASSET':
            health['warnings'].append('no_recent_activity')
        
        # Calculate balance trend
        recent_change = account.entries.filter(
            effective_date__gte=seven_days_ago
        ).aggregate(Sum('signed_amount'))['signed_amount__sum'] or Decimal('0')
        
        if recent_change > 0:
            health['balance_trend'] = 'increasing'
        elif recent_change < 0:
            health['balance_trend'] = 'decreasing'
        
        return Response({
            'account_id': str(account.id),
            'health': health
        })
    
    @action(detail=True, methods=['get'])
    def activity(self, request, pk=None):
        """GET /accounts/{id}/activity/ - Recent activity with rich context."""
        account = self.get_object()
        limit = int(request.query_params.get('limit', 10))
        
        # Optimized query with all related data
        entries = account.entries.select_related(
            'category', 'account'
        ).prefetch_related(
            'transfer_from__to_entry__account',
            'transfer_to__from_entry__account',
        ).order_by('-effective_date', '-id')[:limit]
        
        activity = []
        for entry in entries:
            # Determine transfer context
            is_transfer = (
                hasattr(entry, 'transfer_from') and entry.transfer_from is not None
                or hasattr(entry, 'transfer_to') and entry.transfer_to is not None
            )
            other_account = None
            transfer_direction = None
            
            if is_transfer:
                try:
                    if hasattr(entry, 'transfer_from') and entry.transfer_from:
                        other_account = entry.transfer_from.to_entry.account.name
                        transfer_direction = 'outgoing'
                    elif hasattr(entry, 'transfer_to') and entry.transfer_to:
                        other_account = entry.transfer_to.from_entry.account.name
                        transfer_direction = 'incoming'
                except AttributeError:
                    # Handle case where transfer relationships might not be properly loaded
                    pass
            
            # Category information
            effective_category = None
            if entry.category:
                effective_category = {
                    'type': 'direct',
                    'name': entry.category.name,
                    'id': str(entry.category.id)
                }
            else:
                effective_category = {
                    'type': 'uncategorized',
                    'name': 'Uncategorized'
                }
            
            activity.append({
                'id': str(entry.id),
                'date': entry.effective_date,
                'description': entry.description,
                'amount': str(entry.signed_amount),
                'raw_amount': str(entry.raw_amount),
                'is_transfer': is_transfer,
                'transfer_direction': transfer_direction,
                'other_account': other_account,
                'effective_category': effective_category,
                'reconciliation_status': 'matched' if entry.is_matched else 'unmatched',
            })
        
        return Response({
            'account_id': str(account.id),
            'activity': activity
        })
    
    @action(detail=True, methods=['get'])
    def dashboard(self, request, pk=None):
        """GET /accounts/{id}/dashboard/ - Complete dashboard data in single optimized call."""
        account = self.get_object()
        
        # Get all dashboard data using the optimized individual endpoints
        summary_response = self.financial_summary(request, pk)
        health_response = self.health(request, pk)
        activity_response = self.activity(request, pk)
        
        return Response({
            'account': {
                'id': str(account.id),
                'name': account.name,
                'type': account.type,
                'subtype': account.subtype,
                'type_display': account.get_type_display(),
                'subtype_display': account.get_subtype_display(),
                'currency': account.currency,
                'current_balance': str(account.cached_actual_balance),
                'credit_limit': str(account.credit_limit) if account.credit_limit else None,
                'interest_rate_apr': str(account.interest_rate_apr) if account.interest_rate_apr else None,
            },
            'financial_summary': summary_response.data['summary'],
            'health': health_response.data['health'],
            'recent_activity': activity_response.data['activity'][:5]  # Top 5 for dashboard
        })
    
    # Keep existing endpoints for compatibility
    @action(detail=True, methods=['get'])
    def balance_history(self, request, pk=None):
        """Get balance history for a specific account."""
        account = self.get_object()
        
        # Get all entries for this account ordered by date
        entries = account.entries.all().order_by('effective_date')
        
        balance_history = []
        running_balance = 0
        
        for entry in entries:
            running_balance += entry.signed_amount
            balance_history.append({
                'date': entry.effective_date,
                'description': entry.description,
                'amount': str(entry.signed_amount),
                'balance': str(running_balance),
                'entry_id': str(entry.id)
            })
        
        return Response({
            'account_id': str(account.id),
            'account_name': account.name,
            'current_balance': str(account.balance()),
            'history': balance_history
        })
    
    @action(detail=True, methods=['get'])
    def recent_entries(self, request, pk=None):
        """Get recent entries for a specific account."""
        account = self.get_object()
        
        # Get recent entries (last 10 by default)
        limit = int(request.query_params.get('limit', 10))
        entries = account.entries.all().order_by('-effective_date')[:limit]
        
        entries_data = []
        for entry in entries:
            entries_data.append({
                'id': str(entry.id),
                'effective_date': entry.effective_date,
                'description': entry.description,
                'raw_amount': str(entry.raw_amount),
                'signed_amount': str(entry.signed_amount),
                'category': entry.category.name if entry.category else None,
            })
        
        return Response({
            'account_id': str(account.id),
            'account_name': account.name,
            'entries': entries_data
        })
    
    @action(detail=True, methods=['post'])
    def refresh_balance(self, request, pk=None):
        """Refresh the account balance by recalculating from ledger entries."""
        account = self.get_object()
        
        try:
            refresh_result = AccountBalanceService.refresh_balance(account)
            
            return Response({
                'success': True,
                'message': 'Balance refresh completed successfully',
                'account_id': refresh_result['account_id'],
                'account_name': refresh_result['account_name'],
                'previous_balance': str(refresh_result['cached_balance']),
                'current_balance': str(refresh_result['calculated_balance']),
                'difference': str(refresh_result['difference']),
                'was_updated': refresh_result['was_updated']
            })
            
        except Exception as e:
            return Response(
                {
                    'success': False,
                    'error': f'Failed to refresh balance: {str(e)}'
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def destroy(self, request, *args, **kwargs):
        """Override destroy to check for related entries."""
        account = self.get_object()
        
        # Check if account has any entries
        if account.entries.exists():
            return Response(
                {'error': 'Cannot delete account with existing entries. Please delete all entries first.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        return super().destroy(request, *args, **kwargs)
