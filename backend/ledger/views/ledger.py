from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.db.models import Q, Sum, Prefetch, Min, Max
from datetime import datetime, timedelta
from decimal import Decimal

from ledger.models import LedgerEntry
from ledger.serializers import (
    LedgerEntrySerializer, 
    LedgerEntryListSerializer, 
    LedgerEntryCreateSerializer
)


class LedgerEntryViewSet(viewsets.ModelViewSet):
    """
    Optimized LedgerEntry ViewSet for financial transaction management.
    
    Provides:
    - Optimized list views with proper prefetching
    - Enhanced account transaction endpoints
    - Smart query optimization based on action
    """
    queryset = LedgerEntry.objects.all()
    serializer_class = LedgerEntrySerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['is_matched']
    search_fields = ['description']
    ordering_fields = ['effective_date', 'raw_amount', 'signed_amount']
    ordering = ['-effective_date']
    
    def get_serializer_class(self):
        """Use different serializers for different actions."""
        if self.action == 'list':
            return LedgerEntryListSerializer
        elif self.action == 'create':
            return LedgerEntryCreateSerializer
        return LedgerEntrySerializer
    
    def get_queryset(self):
        """Strategic optimization based on action and filters."""
        queryset = LedgerEntry.objects.select_related('account', 'category')
        
        if self.action == 'list':
            # Optimize for list views with transfer context
            queryset = queryset.prefetch_related(
                'transfer_from__to_entry__account',
                'transfer_to__from_entry__account'
            ).order_by('-effective_date', '-id')
            
        elif self.action == 'retrieve':
            # Full context for detail view
            queryset = queryset.prefetch_related(
                'transfer_from__to_entry__account',
                'transfer_to__from_entry__account'
            )
        
        # Apply common optimizations
        return self._apply_common_filters(queryset)
    
    def list(self, request, *args, **kwargs):
        """Enhanced list with cursor-based pagination for infinite scroll."""
        # Get pagination parameters
        limit = int(request.query_params.get('limit', 50))
        cursor_date = request.query_params.get('cursor_date')
        cursor_id = request.query_params.get('cursor_id')
        
        # Get base queryset
        queryset = self.get_queryset()
        
        # CRITICAL FIX: Apply DRF filters that were being bypassed
        queryset = self.filter_queryset(queryset)
        
        # Custom filtering for accounts and categories (handles both single and multiple values)
        account_params = request.query_params.getlist('account')
        if account_params:
            queryset = queryset.filter(account_id__in=account_params)
            
        category_params = request.query_params.getlist('category')  
        if category_params:
            queryset = queryset.filter(category_id__in=category_params)
        
        # Apply cursor-based filtering for infinite scroll
        if cursor_date and cursor_id:
            try:
                cursor_date_parsed = datetime.strptime(cursor_date, '%Y-%m-%d').date()
                queryset = queryset.filter(
                    Q(effective_date__lt=cursor_date_parsed) |
                    Q(effective_date=cursor_date_parsed, id__lt=cursor_id)
                )
            except (ValueError, TypeError):
                # Invalid cursor parameters, ignore and start from beginning
                pass
        
        # Fetch one extra to determine if there are more results
        entries = list(queryset[:limit + 1])
        has_more = len(entries) > limit
        
        # Remove the extra entry if it exists
        if has_more:
            entries = entries[:-1]
        
        # Generate next cursor for pagination
        next_cursor = None
        if has_more and entries:
            last_entry = entries[-1]
            next_cursor = {
                'cursor_date': last_entry.effective_date.isoformat(),
                'cursor_id': str(last_entry.id)
            }
        
        # Serialize the data
        serializer = self.get_serializer(entries, many=True)
        
        # Get total count for the filtered queryset (for bulk operations)
        total_count = queryset.count()
        
        # Return paginated response
        return Response({
            'results': serializer.data,
            'has_more': has_more,
            'next_cursor': next_cursor,
            'count': len(entries),  # Current page count
            'total_count': total_count  # Total filtered count
        })
    
    def _apply_common_filters(self, queryset):
        """Apply common date and amount filtering."""
        # Custom date range filtering
        date_from = self.request.query_params.get('date_from')
        date_to = self.request.query_params.get('date_to')
        
        if date_from:
            try:
                date_from = datetime.strptime(date_from, '%Y-%m-%d').date()
                queryset = queryset.filter(effective_date__gte=date_from)
            except ValueError:
                pass
        
        if date_to:
            try:
                date_to = datetime.strptime(date_to, '%Y-%m-%d').date()
                queryset = queryset.filter(effective_date__lte=date_to)
            except ValueError:
                pass
        
        # Filter by amount range
        amount_min = self.request.query_params.get('amount_min')
        amount_max = self.request.query_params.get('amount_max')
        
        if amount_min:
            try:
                amount_min = float(amount_min)
                queryset = queryset.filter(raw_amount__gte=amount_min)
            except ValueError:
                pass
        
        if amount_max:
            try:
                amount_max = float(amount_max)
                queryset = queryset.filter(raw_amount__lte=amount_max)
            except ValueError:
                pass
        
        # Filter by entry type
        entry_type = self.request.query_params.get('entry_type')
        if entry_type == 'transfers':
            queryset = queryset.filter(
                Q(transfer_from__isnull=False) | Q(transfer_to__isnull=False)
            )
        
        return queryset
    
    def _apply_filters_from_dict(self, queryset, filters):
        """Apply filters from dictionary (for bulk operations)."""
        # Account filter (single or multiple)
        account_id = filters.get('accountId')
        account_ids = filters.get('accountIds', [])
        if account_id:
            queryset = queryset.filter(account_id=account_id)
        elif account_ids:
            queryset = queryset.filter(account_id__in=account_ids)
        
        # Category filter (single or multiple)
        category_id = filters.get('categoryId') 
        category_ids = filters.get('categoryIds', [])
        if category_id:
            queryset = queryset.filter(category_id=category_id)
        elif category_ids:
            queryset = queryset.filter(category_id__in=category_ids)
        
        # Date range filters
        date_from = filters.get('dateFrom')
        if date_from:
            try:
                date_from = datetime.strptime(date_from, '%Y-%m-%d').date()
                queryset = queryset.filter(effective_date__gte=date_from)
            except ValueError:
                pass
        
        date_to = filters.get('dateTo')
        if date_to:
            try:
                date_to = datetime.strptime(date_to, '%Y-%m-%d').date()
                queryset = queryset.filter(effective_date__lte=date_to)
            except ValueError:
                pass
        
        # Entry type filter
        entry_type = filters.get('entryType')
        if entry_type == 'transfers':
            queryset = queryset.filter(
                Q(transfer_from__isnull=False) | Q(transfer_to__isnull=False)
            )
        
        # Search filter
        search = filters.get('search')
        if search:
            queryset = queryset.filter(description__icontains=search)
        
        # Show uncategorized filter
        show_uncategorized = filters.get('showUncategorized')
        if show_uncategorized:
            queryset = queryset.filter(category_id__isnull=True)
        
        # Transfer visibility filter
        show_transfers = filters.get('showTransfers')
        if show_transfers is False:
            queryset = queryset.filter(
                Q(transfer_from__isnull=True) & Q(transfer_to__isnull=True)
            )
        
        # Matched status filter
        show_matched = filters.get('showMatched')
        if show_matched is False:
            queryset = queryset.filter(is_matched=False)
        
        return queryset
    
    @action(detail=False, methods=['get'])
    def account_transactions(self, request):
        """
        GET /entries/account_transactions/?account_id=X - Optimized for account detail pages.
        
        Query Parameters:
        - account_id (required): Account UUID
        - limit (optional): Number of transactions to return (default: 20)
        - include_running_balance (optional): Include running balance calculation (default: false)
        - date_from, date_to: Date filtering
        """
        account_id = request.query_params.get('account_id')
        if not account_id:
            return Response({'error': 'account_id parameter required'}, status=400)
        
        limit = int(request.query_params.get('limit', 20))
        include_running_balance = request.query_params.get('include_running_balance', 'false').lower() == 'true'
        
        # Build optimized queryset
        queryset = LedgerEntry.objects.filter(account_id=account_id).select_related(
            'account', 'category'
        ).prefetch_related(
            'transfer_from__to_entry__account',
            'transfer_to__from_entry__account',
        )
        
        # Apply date filtering
        queryset = self._apply_date_filters(queryset)
        
        # Order and limit
        entries = queryset.order_by('-effective_date', '-id')[:limit]
        
        transactions = []
        for entry in entries:
            # Enhanced transaction data
            transaction_data = {
                'id': str(entry.id),
                'effective_date': entry.effective_date,
                'description': entry.description,
                'raw_amount': str(entry.raw_amount),
                'signed_amount': str(entry.signed_amount),
                'account_name': entry.account.name,
                'account_type': entry.account.type,
                'category_name': entry.category.name if entry.category else None,
                'category_type': entry.category.type if entry.category else None,
                'is_matched': entry.is_matched,
                'reconciliation_status': 'matched' if entry.is_matched else 'unmatched',
                
                # Transfer context
                'is_transfer': self._is_transfer(entry),
                'transfer_direction': None,
                'other_account_name': None,
                'transfer_details': None
            }
            
            # Add transfer details if applicable
            if transaction_data['is_transfer']:
                transfer_info = self._get_transfer_info(entry)
                transaction_data.update(transfer_info)
            
            # Add effective category information
            transaction_data['effective_category'] = self._get_effective_category(entry)
            
            # Add running balance if requested (expensive operation)
            if include_running_balance:
                running_balance = LedgerEntry.objects.filter(
                    account_id=account_id,
                    effective_date__lte=entry.effective_date,
                    id__lte=entry.id
                ).aggregate(Sum('signed_amount'))['signed_amount__sum'] or Decimal('0')
                transaction_data['running_balance'] = str(running_balance)
            
            transactions.append(transaction_data)
        
        return Response({
            'account_id': account_id,
            'transactions': transactions,
            'includes_running_balance': include_running_balance,
            'count': len(transactions)
        })
    
    def _apply_date_filters(self, queryset):
        """Apply date filtering from query parameters."""
        date_from = self.request.query_params.get('date_from')
        date_to = self.request.query_params.get('date_to')
        
        if date_from:
            try:
                date_from = datetime.strptime(date_from, '%Y-%m-%d').date()
                queryset = queryset.filter(effective_date__gte=date_from)
            except ValueError:
                pass
        
        if date_to:
            try:
                date_to = datetime.strptime(date_to, '%Y-%m-%d').date()
                queryset = queryset.filter(effective_date__lte=date_to)
            except ValueError:
                pass
        
        return queryset
    
    def _is_transfer(self, entry):
        """Check if entry is part of a transfer."""
        return (
            hasattr(entry, 'transfer_from') and entry.transfer_from is not None
            or hasattr(entry, 'transfer_to') and entry.transfer_to is not None
        )
    
    def _get_transfer_info(self, entry):
        """Get transfer information for an entry."""
        transfer_info = {
            'transfer_direction': None,
            'other_account_name': None,
            'transfer_details': None
        }
        
        try:
            if hasattr(entry, 'transfer_from') and entry.transfer_from:
                transfer = entry.transfer_from
                other_entry = transfer.to_entry
                transfer_info.update({
                    'transfer_direction': 'outgoing',
                    'other_account_name': other_entry.account.name,
                    'transfer_details': {
                        'transfer_id': str(transfer.id),
                        'other_account_id': str(other_entry.account.id),
                        'transfer_amount': str(abs(entry.raw_amount)),
                    }
                })
            elif hasattr(entry, 'transfer_to') and entry.transfer_to:
                transfer = entry.transfer_to
                other_entry = transfer.from_entry
                transfer_info.update({
                    'transfer_direction': 'incoming',
                    'other_account_name': other_entry.account.name,
                    'transfer_details': {
                        'transfer_id': str(transfer.id),
                        'other_account_id': str(other_entry.account.id),
                        'transfer_amount': str(abs(entry.raw_amount)),
                    }
                })
        except AttributeError:
            # Handle cases where transfer relationships might not be properly loaded
            pass
        
        return transfer_info
    
    def _get_effective_category(self, entry):
        """Get effective category information."""
        if entry.category:
            return {
                'type': 'direct',
                'category_id': str(entry.category.id),
                'category_name': entry.category.name,
                'category_type': entry.category.type,
            }
        else:
            return {
                'type': 'uncategorized',
                'category_id': None,
                'category_name': 'Uncategorized',
            }
    
    @action(detail=False, methods=['get'])
    def recent(self, request):
        """Get recent entries across all accounts."""
        days = int(request.query_params.get('days', 7))
        since_date = datetime.now().date() - timedelta(days=days)
        
        entries = self.get_queryset().filter(
            effective_date__gte=since_date
        ).order_by('-effective_date')[:50]  # Limit to 50 entries
        
        serializer = LedgerEntryListSerializer(entries, many=True)
        return Response({
            'since_date': since_date,
            'count': len(entries),
            'entries': serializer.data
        })
    
    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Get summary statistics for entries."""
        queryset = self.get_queryset()
        
        # Basic counts
        total_entries = queryset.count()
        matched_entries = queryset.filter(is_matched=True).count()
        unmatched_entries = total_entries - matched_entries
        
        # Amount statistics (by account type)
        asset_entries = queryset.filter(account__type='ASSET')
        liability_entries = queryset.filter(account__type='LIABILITY')
        
        asset_total = sum(entry.signed_amount for entry in asset_entries)
        liability_total = sum(entry.signed_amount for entry in liability_entries)
        
        return Response({
            'total_entries': total_entries,
            'reconciliation': {
                'matched': matched_entries,
                'unmatched': unmatched_entries
            },
            'amounts': {
                'asset_total': str(asset_total),
                'liability_total': str(liability_total),
                'net_total': str(asset_total + liability_total)
            }
        })
    
    @action(detail=False, methods=['get'])
    def filtered_ids(self, request):
        """
        Get all transaction IDs matching current filters.
        GET /entries/filtered_ids/?[filter_params]
        
        Returns lightweight response with just IDs and summary info.
        This enables efficient "select all filtered" functionality.
        """
        queryset = self.get_queryset()  # Uses existing filter logic
        
        # Get all IDs (efficient query - only selects id column)
        transaction_ids = list(queryset.values_list('id', flat=True))
        
        # Get summary info for user feedback
        if transaction_ids:
            date_range = queryset.aggregate(
                earliest=Min('effective_date'),
                latest=Max('effective_date')
            )
            
            # Get affected accounts (limit to avoid large responses)
            affected_accounts = list(
                queryset.values_list('account__name', flat=True).distinct()[:10]
            )
        else:
            date_range = {'earliest': None, 'latest': None}
            affected_accounts = []
        
        return Response({
            'transaction_ids': [str(id) for id in transaction_ids],
            'total_count': len(transaction_ids),
            'summary': {
                'earliest_date': date_range['earliest'].isoformat() if date_range['earliest'] else None,
                'latest_date': date_range['latest'].isoformat() if date_range['latest'] else None,
                'affected_accounts': affected_accounts
            }
        })
    
    @action(detail=False, methods=['post'])
    def bulk_update(self, request):
        """
        Unified bulk update for both selection modes.
        POST /entries/bulk_update/
        
        Body:
        {
            "selection": {
                "mode": "individual" | "all-filtered-except",
                
                // For individual mode:
                "entry_ids": ["uuid1", "uuid2", ...],
                
                // For all-filtered-except mode:
                "filters": { /* filter parameters */ },
                "excluded_ids": ["uuid3", "uuid4", ...]  // Optional
            },
            "changes": {
                "category": "category_uuid" | null
            }
        }
        
        Legacy support: if entry_ids is provided directly, treats as individual mode.
        """
        changes = request.data.get('changes', {})
        if not changes:
            return Response({'error': 'changes is required'}, status=400)
        
        # Legacy support: direct entry_ids parameter
        legacy_entry_ids = request.data.get('entry_ids')
        if legacy_entry_ids:
            selection = {
                'mode': 'individual',
                'entry_ids': legacy_entry_ids
            }
        else:
            selection = request.data.get('selection', {})
        
        selection_mode = selection.get('mode')
        if selection_mode not in ['individual', 'all-filtered-except']:
            return Response({'error': 'Invalid selection mode'}, status=400)
        
        # Validate changes structure
        if 'category' in changes:
            category_id = changes['category']
            if category_id is not None:
                # Validate category exists and belongs to user
                try:
                    from ledger.models import Category
                    Category.objects.get(id=category_id, user=request.user)
                except Category.DoesNotExist:
                    return Response({'error': 'Invalid category ID'}, status=400)
        
        # Build target queryset based on selection mode
        if selection_mode == 'individual':
            entry_ids = selection.get('entry_ids', [])
            if not entry_ids:
                return Response({'error': 'entry_ids required for individual mode'}, status=400)
            
            queryset = LedgerEntry.objects.filter(
                id__in=entry_ids,
                account__user=request.user
            )
            
            # Validate all IDs exist
            found_ids = list(queryset.values_list('id', flat=True))
            missing_ids = [id for id in entry_ids if id not in [str(fid) for fid in found_ids]]
            if missing_ids:
                return Response(
                    {'error': f'Entries not found: {missing_ids[:5]}'}, 
                    status=404
                )
                
        else:  # all-filtered-except mode
            filters = selection.get('filters', {})
            excluded_ids = selection.get('excluded_ids', [])
            
            # Start with user's entries
            queryset = LedgerEntry.objects.filter(account__user=request.user)
            
            # Apply filters using existing logic
            queryset = self._apply_filters_from_dict(queryset, filters)
            
            # Exclude specific IDs
            if excluded_ids:
                queryset = queryset.exclude(id__in=excluded_ids)
        
        # Apply bulk update using Django's efficient bulk_update
        update_fields = []
        update_data = {}
        
        if 'category' in changes:
            update_fields.append('category_id')
            update_data['category_id'] = changes['category']
        
        # Handle reconciliation status updates
        if 'reconciliation_status' in changes:
            action = changes['reconciliation_status']
            if action == 'mark_cleared':
                update_data['is_matched'] = True
                update_data['reconciliation_status'] = 'matched'
            elif action == 'mark_uncleared':
                update_data['is_matched'] = False
                update_data['reconciliation_status'] = 'unmatched'
        
        # For transfers, we might want to skip category updates to maintain transfer logic
        # For now, we'll allow it but could add validation later
        
        try:
            # Use bulk_update for maximum efficiency
            updated_count = queryset.update(**update_data)
            
            return Response({
                'updated_count': updated_count,
                'selection_mode': selection_mode,
                'message': f'Successfully updated {updated_count} transactions'
            })
            
        except Exception as e:
            return Response(
                {'error': f'Bulk update failed: {str(e)}'}, 
                status=500
            )

    @action(detail=False, methods=['post'])
    def bulk_reconcile(self, request):
        """
        Bulk update reconciliation status for multiple entries.
        POST /entries/bulk_reconcile/
        
        Body:
        {
            "entry_ids": ["uuid1", "uuid2", ...],
            "reconciliation_action": "mark_cleared" | "mark_uncleared"
        }
        """
        entry_ids = request.data.get('entry_ids', [])
        action = request.data.get('reconciliation_action')
        
        if not entry_ids:
            return Response({'error': 'entry_ids is required'}, status=400)
        
        if action not in ['mark_cleared', 'mark_uncleared']:
            return Response(
                {'error': 'reconciliation_action must be "mark_cleared" or "mark_uncleared"'}, 
                status=400
            )
        
        # Get entries
        entries = LedgerEntry.objects.filter(id__in=entry_ids)
        found_ids = [str(entry.id) for entry in entries]
        missing_ids = [id for id in entry_ids if id not in found_ids]
        
        if missing_ids:
            return Response(
                {'error': f'Entries not found: {missing_ids}'}, 
                status=404
            )
        
        # Check if any entries are part of transfers (reconciliation rules may vary)
        transfer_entries = []
        for entry in entries:
            if (hasattr(entry, 'transfer_from') and entry.transfer_from is not None
                or hasattr(entry, 'transfer_to') and entry.transfer_to is not None):
                transfer_entries.append(str(entry.id))
        
        # Update reconciliation status using Django's bulk_update for efficiency
        updated_count = 0
        skipped_count = 0
        skipped_entries = []
        
        try:
            # Prepare entries for bulk update, skipping those with statement lines
            entries_to_update = []
            for entry in entries:
                # Skip entries that are already matched to statement lines
                # These cannot be manually reconciled/unreconciled
                if entry.source_statement_line is not None:
                    skipped_count += 1
                    skipped_entries.append({
                        'id': str(entry.id),
                        'reason': 'Already matched to statement line',
                        'description': entry.description
                    })
                    continue
                
                if action == 'mark_cleared':
                    entry.is_matched = True
                    # For manual clearing, source_statement_line remains None
                else:  # mark_uncleared
                    entry.is_matched = False
                    # source_statement_line remains None for manual entries
                
                entries_to_update.append(entry)
            
            # Use Django's bulk_update for efficient database operation
            if entries_to_update:
                LedgerEntry.objects.bulk_update(
                    entries_to_update, 
                    ['is_matched'],  # Only update the is_matched field
                    batch_size=100   # Process in batches for very large updates
                )
                updated_count = len(entries_to_update)
                
        except Exception as e:
            return Response(
                {'error': f'Bulk update failed: {str(e)}'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        return Response({
            'message': f'Bulk reconciliation completed',
            'updated_count': updated_count,
            'skipped_count': skipped_count,
            'total_requested': len(entry_ids),
            'transfer_entries_included': transfer_entries,
            'skipped_entries': skipped_entries,
            'action_performed': action
        })
    
    def destroy(self, request, *args, **kwargs):
        """Override destroy to handle transfers."""
        entry = self.get_object()
        
        # Check if entry is part of a transfer
        is_transfer = (
            hasattr(entry, 'transfer_from') and entry.transfer_from is not None
            or hasattr(entry, 'transfer_to') and entry.transfer_to is not None
        )
        
        if is_transfer:
            return Response(
                {'error': 'Cannot delete entry that is part of a transfer. Delete the transfer instead.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        return super().destroy(request, *args, **kwargs)
