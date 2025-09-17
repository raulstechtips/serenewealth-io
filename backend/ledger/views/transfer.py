from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.db import transaction
from django.db.models import Q
from datetime import datetime, timedelta

from ledger.models import Transfer, Account
from ledger.serializers.transfer import (
    TransferSerializer,
    TransferListSerializer,
    TransferCreateSerializer,
    TransferUpdateSerializer,
    TransferValidationSerializer,
)


class TransferViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Transfer model providing CRUD operations.
    
    Provides:
    - List transfers with filtering and search
    - Create new transfers (using optimized Transfer.create_transfer())
    - Retrieve transfer details
    - Update transfer descriptions
    - Delete transfers (with balance reversal)
    - Validate transfers before creation
    - Transfer analytics and summaries
    """
    queryset = Transfer.objects.all()
    serializer_class = TransferSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    search_fields = ['from_entry__description', 'to_entry__description']
    ordering_fields = ['from_entry__effective_date']
    ordering = ['-from_entry__effective_date']
    
    def get_serializer_class(self):
        """Use different serializers for different actions."""
        if self.action == 'list':
            return TransferListSerializer
        elif self.action == 'create':
            return TransferCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return TransferUpdateSerializer
        elif self.action == 'validate':
            return TransferValidationSerializer
        return TransferSerializer
    
    def get_queryset(self):
        """Optimize queryset with custom filtering."""
        queryset = Transfer.objects.select_related(
            'from_entry__account',
            'to_entry__account'
        )
        
        # Custom date range filtering
        date_from = self.request.query_params.get('date_from')
        date_to = self.request.query_params.get('date_to')
        
        if date_from:
            try:
                date_from = datetime.strptime(date_from, '%Y-%m-%d').date()
                queryset = queryset.filter(from_entry__effective_date__gte=date_from)
            except ValueError:
                pass
        
        if date_to:
            try:
                date_to = datetime.strptime(date_to, '%Y-%m-%d').date()
                queryset = queryset.filter(from_entry__effective_date__lte=date_to)
            except ValueError:
                pass
        
        # Filter by amount range
        amount_min = self.request.query_params.get('amount_min')
        amount_max = self.request.query_params.get('amount_max')
        
        if amount_min:
            try:
                amount_min = float(amount_min)
                queryset = queryset.filter(to_entry__raw_amount__gte=amount_min)
            except ValueError:
                pass
        
        if amount_max:
            try:
                amount_max = float(amount_max)
                queryset = queryset.filter(to_entry__raw_amount__lte=amount_max)
            except ValueError:
                pass
        
        # Filter by account
        from_account = self.request.query_params.get('from_account')
        to_account = self.request.query_params.get('to_account')
        account = self.request.query_params.get('account')  # Either from or to
        
        if from_account:
            queryset = queryset.filter(from_entry__account_id=from_account)
        
        if to_account:
            queryset = queryset.filter(to_entry__account_id=to_account)
        
        if account:
            queryset = queryset.filter(
                Q(from_entry__account_id=account) | Q(to_entry__account_id=account)
            )
        
        return queryset
    
    def create(self, request, *args, **kwargs):
        """Create transfer using optimized Transfer.create_transfer() method."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        try:
            transfer = serializer.save()
            
            # Return detailed response
            response_serializer = TransferSerializer(transfer)
            return Response(
                response_serializer.data,
                status=status.HTTP_201_CREATED
            )
        
        except Exception as e:
            return Response(
                {'error': f'Failed to create transfer: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=False, methods=['post'])
    def validate(self, request):
        """
        Validate a transfer without creating it.
        Useful for pre-flight checks in the UI.
        """
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        validation_result = serializer.validated_data['validation_result']
        
        return Response({
            'validation': validation_result,
            'from_account': {
                'id': str(serializer.validated_data['from_account'].id),
                'name': serializer.validated_data['from_account'].name,
                'current_balance': str(validation_result['from_account_balance']),
                'balance_after': str(validation_result['from_account_balance_after']),
            },
            'to_account': {
                'id': str(serializer.validated_data['to_account'].id),
                'name': serializer.validated_data['to_account'].name,
                'current_balance': str(validation_result['to_account_balance']),
                'balance_after': str(validation_result['to_account_balance_after']),
            },
            'transfer_info': {
                'amount': str(serializer.validated_data['amount']),
            }
        })
    
    @action(detail=False, methods=['get'])
    def recent(self, request):
        """Get recent transfers across all accounts."""
        days = int(request.query_params.get('days', 7))
        since_date = datetime.now().date() - timedelta(days=days)
        
        transfers = self.get_queryset().filter(
            from_entry__effective_date__gte=since_date
        )[:50]  # Limit to 50 transfers
        
        serializer = TransferListSerializer(transfers, many=True)
        return Response({
            'since_date': since_date,
            'count': len(transfers),
            'transfers': serializer.data
        })
    
    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Get summary statistics for transfers."""
        queryset = self.get_queryset()
        
        # Basic counts
        total_transfers = queryset.count()
        regular_transfers = total_transfers
        
        # Amount statistics
        total_amount = sum(
            abs(transfer.to_entry.raw_amount) for transfer in queryset
        )
        
        return Response({
            'totals': {
                'total_transfers': total_transfers,
                'regular_transfers': regular_transfers,
            },
            'amounts': {
                'total_amount': str(total_amount),
            }
        })
    
    @action(detail=False, methods=['get'])
    def by_account(self, request):
        """Get transfers grouped by account."""
        account_id = request.query_params.get('account_id')
        
        if not account_id:
            return Response(
                {'error': 'account_id parameter is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            account = Account.objects.get(id=account_id)
        except Account.DoesNotExist:
            return Response(
                {'error': 'Account not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Get transfers where this account is involved
        transfers = self.get_queryset().filter(
            Q(from_entry__account=account) | Q(to_entry__account=account)
        )
        
        outgoing_transfers = []
        incoming_transfers = []
        
        for transfer in transfers:
            transfer_data = {
                'id': str(transfer.id),
                'amount': str(abs(transfer.to_entry.raw_amount)),
                'effective_date': transfer.from_entry.effective_date,
                'description': transfer.from_entry.description,
            }
            
            if transfer.from_entry.account == account:
                # Outgoing transfer
                transfer_data['other_account'] = {
                    'id': str(transfer.to_entry.account.id),
                    'name': transfer.to_entry.account.name,
                }
                outgoing_transfers.append(transfer_data)
            else:
                # Incoming transfer
                transfer_data['other_account'] = {
                    'id': str(transfer.from_entry.account.id),
                    'name': transfer.from_entry.account.name,
                }
                incoming_transfers.append(transfer_data)
        
        return Response({
            'account': {
                'id': str(account.id),
                'name': account.name,
            },
            'outgoing_transfers': outgoing_transfers,
            'incoming_transfers': incoming_transfers,
            'summary': {
                'total_outgoing': len(outgoing_transfers),
                'total_incoming': len(incoming_transfers),
                'total_outgoing_amount': str(sum(
                    abs(t.to_entry.raw_amount) for t in transfers 
                    if t.from_entry.account == account
                )),
                'total_incoming_amount': str(sum(
                    abs(t.to_entry.raw_amount) for t in transfers 
                    if t.to_entry.account == account
                )),
            }
        })
    
    @action(detail=True, methods=['get'])
    def entries(self, request, pk=None):
        """Get the ledger entries associated with this transfer."""
        transfer = self.get_object()
        
        from ledger.serializers.ledger import LedgerEntrySerializer
        
        from_entry_data = LedgerEntrySerializer(transfer.from_entry).data
        to_entry_data = LedgerEntrySerializer(transfer.to_entry).data
        
        return Response({
            'transfer_id': str(transfer.id),
            'from_entry': from_entry_data,
            'to_entry': to_entry_data,
            'transfer_amount': str(abs(transfer.to_entry.raw_amount)),
        })
    
    def destroy(self, request, *args, **kwargs):
        """Override destroy to properly handle balance reversal."""
        transfer = self.get_object()
        
        try:
            # The Transfer.delete() method handles balance updates automatically
            transfer_id = str(transfer.id)
            from_account_name = transfer.from_entry.account.name
            to_account_name = transfer.to_entry.account.name
            amount = abs(transfer.to_entry.raw_amount)
            
            transfer.delete()
            
            return Response({
                'message': 'Transfer deleted successfully',
                'deleted_transfer': {
                    'id': transfer_id,
                    'from_account': from_account_name,
                    'to_account': to_account_name,
                    'amount': str(amount),
                }
            })
        
        except Exception as e:
            return Response(
                {'error': f'Failed to delete transfer: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )
