from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.db import transaction

from ledger.models import Statement, StatementLine
from ledger.serializers.statement import (
    StatementSerializer,
    StatementCreateSerializer,
    StatementProcessSerializer,
)
from ledger.services import AccountBalanceService


class StatementViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Statement model providing CRUD operations and processing.
    
    Provides:
    - List statements with filtering
    - Create new statements with lines
    - Retrieve statement details
    - Update statement information
    - Delete statements
    - Process statements (create ledger entries in batch)
    """
    queryset = Statement.objects.all()
    serializer_class = StatementSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['account', 'period_start', 'period_end']
    search_fields = ['account__name']
    ordering_fields = ['period_start', 'period_end', 'opening_balance', 'closing_balance']
    ordering = ['-period_end']
    
    def get_serializer_class(self):
        """Use different serializers for different actions."""
        if self.action == 'create':
            return StatementCreateSerializer
        elif self.action == 'process':
            return StatementProcessSerializer
        return StatementSerializer
    
    def get_queryset(self):
        """Optimize queryset for different actions."""
        queryset = Statement.objects.select_related('account')
        
        # For detail views, prefetch lines
        if self.action in ['retrieve', 'process']:
            queryset = queryset.prefetch_related('lines')
        
        return queryset
    
    @action(detail=True, methods=['post'])
    def process(self, request, pk=None):
        """
        Process statement lines to create ledger entries in batch.
        This is much more efficient than processing lines individually.
        """
        statement = self.get_object()
        
        # Validate processing request
        serializer = self.get_serializer(
            data=request.data,
            context={'statement': statement}
        )
        serializer.is_valid(raise_exception=True)
        
        verify_balance = serializer.validated_data.get('verify_balance', True)
        
        try:
            with transaction.atomic():
                if verify_balance:
                    # Use the batch processing with balance verification
                    created_entries = statement.process_statement_batch()
                else:
                    # Process without balance verification (for manual adjustments)
                    created_entries = AccountBalanceService.process_statement_batch(
                        statement, None  # Skip balance verification
                    )
                
                return Response({
                    'message': 'Statement processed successfully',
                    'statement_id': str(statement.id),
                    'entries_created': len(created_entries),
                    'account_id': str(statement.account.id),
                    'account_name': statement.account.name,
                    'opening_balance': str(statement.opening_balance),
                    'closing_balance': str(statement.closing_balance),
                    'calculated_balance': str(statement.account.cached_actual_balance),
                })
        
        except Exception as e:
            return Response(
                {'error': f'Failed to process statement: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=True, methods=['get'])
    def lines(self, request, pk=None):
        """Get all lines for a specific statement."""
        statement = self.get_object()
        
        lines_data = []
        for line in statement.lines.all().order_by('posted_at'):
            lines_data.append({
                'id': str(line.id),
                'posted_at': line.posted_at,
                'amount': str(line.amount),
                'description': line.description,
                'external_id': line.external_id,
                'is_processed': line.actual_ledger_entry is not None,
                'matched_entry_id': str(line.matched_entry.id) if line.matched_entry else None,
            })
        
        return Response({
            'statement_id': str(statement.id),
            'account_name': statement.account.name,
            'period': f"{statement.period_start} to {statement.period_end}",
            'lines_count': len(lines_data),
            'lines': lines_data,
        })
    
    @action(detail=True, methods=['get'])
    def summary(self, request, pk=None):
        """Get summary information for a statement."""
        statement = self.get_object()
        
        lines = statement.lines.all()
        total_lines = lines.count()
        processed_lines = lines.filter(actual_ledger_entry__isnull=False).count()
        unprocessed_lines = total_lines - processed_lines
        
        # Calculate totals
        total_amount = sum(line.amount for line in lines)
        processed_amount = sum(
            line.amount for line in lines 
            if line.actual_ledger_entry is not None
        )
        
        return Response({
            'statement_id': str(statement.id),
            'account_id': str(statement.account.id),
            'account_name': statement.account.name,
            'period': {
                'start': statement.period_start,
                'end': statement.period_end,
            },
            'balances': {
                'opening': str(statement.opening_balance),
                'closing': str(statement.closing_balance),
                'current_account': str(statement.account.cached_actual_balance),
            },
            'lines': {
                'total': total_lines,
                'processed': processed_lines,
                'unprocessed': unprocessed_lines,
            },
            'amounts': {
                'total_statement': str(total_amount),
                'processed': str(processed_amount),
                'unprocessed': str(total_amount - processed_amount),
            },
            'is_fully_processed': unprocessed_lines == 0,
        })
    
    def destroy(self, request, *args, **kwargs):
        """Override destroy to check for processed lines."""
        statement = self.get_object()
        
        # Check if any lines have been processed
        processed_lines = statement.lines.filter(
            actual_ledger_entry__isnull=False
        ).count()
        
        if processed_lines > 0:
            return Response(
                {
                    'error': f'Cannot delete statement with {processed_lines} processed lines. '
                             'Please delete the associated ledger entries first.'
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        return super().destroy(request, *args, **kwargs)
