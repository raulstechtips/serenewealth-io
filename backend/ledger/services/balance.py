from decimal import Decimal
from typing import List, Optional, Union
from django.db import transaction, models
from django.db.models import F
from django.core.exceptions import ValidationError
from ledger.models import Account, LedgerEntry


class AccountBalanceService:
    """
    Service for managing account balance updates efficiently.
    
    Provides two strategies:
    1. Individual updates: For single transactions, edits, transfers
    2. Batch updates: For statement processing, bulk imports
    """
    
    @staticmethod
    def update_balance_individual(account: Account, delta: Decimal) -> None:
        """
        Update account balance for individual operations.
        
        Args:
            account: Account to update
            delta: Amount to add/subtract from balance (signed amount)
        """
        if delta == 0:
            return
            
        account.cached_actual_balance += delta
        account.save(update_fields=['cached_actual_balance'])
    
    @staticmethod
    def update_balance_batch(account: Account, delta: Decimal) -> None:
        """
        Update account balance for batch operations using F() expressions.
        More efficient for bulk operations and avoids race conditions.
        
        Args:
            account: Account to update
            delta: Amount to add/subtract from balance (signed amount)
        """
        if delta == 0:
            return
            
        Account.objects.filter(id=account.id).update(
            cached_actual_balance=F('cached_actual_balance') + delta
        )
    
    @staticmethod
    def recalculate_balance(account: Account) -> Decimal:
        """
        Recalculate account balance from scratch and update cached value.
        Used for verification and recovery.
        
        Args:
            account: Account to recalculate
            
        Returns:
            The calculated balance
        """
        calculated_balance = account.balance()  # Uses the existing balance() method
        account.cached_actual_balance = calculated_balance
        account.save(update_fields=['cached_actual_balance'])
        return calculated_balance
    
    @staticmethod
    def refresh_balance(account: Account) -> dict:
        """
        Refresh account balance by comparing calculated vs cached balance.
        If they don't match, update the cached balance to the calculated value.
        
        Args:
            account: Account to refresh
            
        Returns:
            Dict with refresh details including whether balance was updated
        """
        calculated_balance = account.balance()
        cached_balance = account.cached_actual_balance
        difference = abs(calculated_balance - cached_balance)
        
        result = {
            'account_id': str(account.id),
            'account_name': account.name,
            'calculated_balance': calculated_balance,
            'cached_balance': cached_balance,
            'difference': difference,
            'was_updated': False
        }
        
        # Update cached balance if there's a discrepancy
        if difference > Decimal('0.01'):  # Allow 1 cent tolerance for rounding
            account.cached_actual_balance = calculated_balance
            account.save(update_fields=['cached_actual_balance'])
            result['was_updated'] = True
        
        return result
    
    @staticmethod
    def handle_entry_created(entry: LedgerEntry) -> None:
        """
        Handle balance update when a new ledger entry is created.
        
        Args:
            entry: The newly created ledger entry
        """
        AccountBalanceService.update_balance_individual(
            entry.account, 
            entry.signed_amount
        )
    
    @staticmethod
    def handle_entry_updated(entry: LedgerEntry, old_signed_amount: Decimal, 
                           old_account: Optional[Account] = None) -> None:
        """
        Handle balance update when a ledger entry is modified.
        
        Args:
            entry: The updated ledger entry
            old_signed_amount: Previous signed amount
            old_account: Previous account (if account was changed)
        """
        # If account changed, remove from old account and add to new
        if old_account and old_account.id != entry.account.id:
            AccountBalanceService.update_balance_individual(
                old_account, 
                -old_signed_amount
            )
            AccountBalanceService.update_balance_individual(
                entry.account, 
                entry.signed_amount
            )
        else:
            # Same account, just update the difference
            delta = entry.signed_amount - old_signed_amount
            AccountBalanceService.update_balance_individual(
                entry.account, 
                delta
            )
    
    @staticmethod
    def handle_entry_deleted(entry: LedgerEntry) -> None:
        """
        Handle balance update when a ledger entry is deleted.
        
        Args:
            entry: The ledger entry being deleted
        """
        AccountBalanceService.update_balance_individual(
            entry.account, 
            -entry.signed_amount
        )
    
    @staticmethod
    @transaction.atomic
    def process_statement_batch(statement, closing_balance_user: Decimal) -> List[LedgerEntry]:
        """
        Process statement lines in batch with balance verification.
        
        Args:
            statement: Statement object with lines
            closing_balance_user: Expected closing balance provided by user
            
        Returns:
            List of created LedgerEntry objects
            
        Raises:
            ValidationError: If balance verification fails
        """
        account = statement.account
        entries_data = []
        total_delta = Decimal('0')
        
        # Prepare all entries
        for line in statement.lines.all():
            signed_amount = LedgerEntry.normalize_signed_amount(account, line.amount)
            entries_data.append(LedgerEntry(
                account=account,
                effective_date=line.posted_at.date(),
                raw_amount=line.amount,
                signed_amount=signed_amount,
                description=line.description,
                source_statement_line=line,
                # Note: category will need to be set separately
            ))
            total_delta += signed_amount
        
        # Bulk create entries
        created_entries = LedgerEntry.objects.bulk_create(entries_data)
        
        # Update balance in batch
        AccountBalanceService.update_balance_batch(account, total_delta)
        
        # Refresh account to get updated balance
        account.refresh_from_db()
        
        # Verify against user-provided closing balance
        balance_diff = abs(account.cached_actual_balance - closing_balance_user)
        if balance_diff > Decimal('0.01'):  # Allow 1 cent tolerance for rounding
            raise ValidationError(
                f"Balance verification failed. Expected: {closing_balance_user}, "
                f"Calculated: {account.cached_actual_balance}, "
                f"Difference: {balance_diff}"
            )
        
        return created_entries
    
    @staticmethod
    @transaction.atomic
    def handle_transfer_created(from_entry: LedgerEntry, to_entry: LedgerEntry) -> None:
        """
        Handle balance updates for transfer creation (affects 2 accounts).
        
        Args:
            from_entry: Source account entry (negative amount)
            to_entry: Destination account entry (positive amount)
        """
        AccountBalanceService.update_balance_individual(
            from_entry.account, 
            from_entry.signed_amount
        )
        AccountBalanceService.update_balance_individual(
            to_entry.account, 
            to_entry.signed_amount
        )
    
    @staticmethod
    @transaction.atomic
    def handle_transfer_deleted(from_entry: LedgerEntry, to_entry: LedgerEntry) -> None:
        """
        Handle balance updates for transfer deletion (affects 2 accounts).
        
        Args:
            from_entry: Source account entry (negative amount)
            to_entry: Destination account entry (positive amount)
        """
        AccountBalanceService.update_balance_individual(
            from_entry.account, 
            -from_entry.signed_amount
        )
        AccountBalanceService.update_balance_individual(
            to_entry.account, 
            -to_entry.signed_amount
        )
    
    @staticmethod
    def verify_account_balance(account: Account, tolerance: Decimal = Decimal('0.01')) -> bool:
        """
        Verify that cached balance matches calculated balance.
        
        Args:
            account: Account to verify
            tolerance: Acceptable difference (default 1 cent)
            
        Returns:
            True if balances match within tolerance
        """
        calculated_balance = account.balance()
        cached_balance = account.cached_actual_balance
        difference = abs(calculated_balance - cached_balance)
        return difference <= tolerance
    
    @staticmethod
    def get_balance_discrepancies(tolerance: Decimal = Decimal('0.01')) -> List[dict]:
        """
        Find all accounts with balance discrepancies.
        
        Args:
            tolerance: Acceptable difference (default 1 cent)
            
        Returns:
            List of dicts with account info and discrepancy details
        """
        discrepancies = []
        
        for account in Account.objects.all():
            calculated = account.balance()
            cached = account.cached_actual_balance
            difference = abs(calculated - cached)
            
            if difference > tolerance:
                discrepancies.append({
                    'account_id': str(account.id),
                    'account_name': account.name,
                    'calculated_balance': calculated,
                    'cached_balance': cached,
                    'difference': difference
                })
        
        return discrepancies
