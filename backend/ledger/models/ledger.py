import uuid
from django.db import models
from decimal import Decimal

from django.core.exceptions import ValidationError
from ledger.models.account import (
    AccountType,
    Account,
)
from ledger.models.category import (
    Category,
)
from ledger.models.statement import StatementLine

class LedgerEntry(models.Model):
    """
    Single, minimal ledger entry used for actual entries.
    'signed_amount' is normalized by account type:
      - ASSET: deposit -> +, withdrawal -> -
      - LIABILITY: charge/interest -> -, payment/reduction -> +

    'raw_amount' is what the user/statement provided from the user's POV:
      raw > 0 means "increase this account" (e.g., deposit to checking, payment to a loan/credit acct)
      raw < 0 means "decrease this account" (e.g., withdraw from checking, charge on a credit acct)
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    account = models.ForeignKey(Account, on_delete=models.CASCADE, related_name="entries")

    effective_date = models.DateField() # date the balance should reflect this entry
    description = models.CharField(max_length=255, blank=True)
    
    raw_amount = models.DecimalField(max_digits=18, decimal_places=2) # as entered/imported
    signed_amount = models.DecimalField(max_digits=18, decimal_places=2) # normalized by account type

    # Optional categorization at the entry level
    category = models.ForeignKey(Category, null=True, blank=True, on_delete=models.SET_NULL, related_name="entries")

    # Reconciliation
    is_matched = models.BooleanField(default=False) # only relevant for StatementLine entries
    source_statement_line = models.OneToOneField('ledger.StatementLine', on_delete=models.SET_NULL, null=True, blank=True, related_name="actual_ledger_entry")

    class Meta:
        indexes = [
            models.Index(fields=["account", "effective_date"]),
            models.Index(fields=["is_matched"]),
        ]
    
    def __str__(self):
        return f"{self.effective_date} {self.signed_amount} ({self.account})"

    def clean(self):
        if self.category_id is None:
            raise ValidationError("Category is required for ledger entries.")
    
    @staticmethod
    def normalize_signed_amount(account: Account, raw: Decimal) -> Decimal:
        """
        Convert 'raw' to 'signed_amount' consistent with account nature.
        We assume raw>0 means "increase the account" from the user's viewpoint.
            - For ASSET: increase => +, decrease => -
            - For LIABILITY: increase of debt => -, payment/reduction => +
        """
        if account.type == AccountType.ASSET:
            return raw
        else: # LIABILITY
            return -raw
    
    @classmethod
    def add_actual(cls, account: Account, effective_date, raw_amount: Decimal, description="", source_statement_line: StatementLine = None):
        return cls.objects.create(
            account=account,
            effective_date=effective_date,
            raw_amount=raw_amount,
            signed_amount=cls.normalize_signed_amount(account, raw_amount),
            description=description,
            source_statement_line=source_statement_line,
        )
    
    def save(self, *args, **kwargs):
        """Override save to handle balance updates."""
        # Skip balance updates for bulk operations (when skip_balance_update=True)
        skip_balance_update = kwargs.pop('skip_balance_update', False)
        
        if not skip_balance_update:
            # Import here to avoid circular imports
            from ledger.services import AccountBalanceService
            
            is_new = self.pk is None
            old_signed_amount = None
            old_account = None
            
            # For updates, get the old values
            if not is_new:
                try:
                    old_instance = LedgerEntry.objects.get(pk=self.pk)
                    old_signed_amount = old_instance.signed_amount
                    old_account = old_instance.account
                except LedgerEntry.DoesNotExist:
                    is_new = True
        
        # Calculate signed_amount if needed
        if self.account and self.raw_amount is not None:
            self.signed_amount = self.normalize_signed_amount(self.account, self.raw_amount)
        
        # Save the instance
        super().save(*args, **kwargs)
        
        # Update balance after save (only for non-bulk operations)
        if not skip_balance_update:
            from ledger.services import AccountBalanceService
            
            if is_new:
                AccountBalanceService.handle_entry_created(self)
            else:
                AccountBalanceService.handle_entry_updated(
                    self, old_signed_amount, old_account
                )
    
    def delete(self, *args, **kwargs):
        """Override delete to handle balance updates."""
        # Skip balance updates for bulk operations
        skip_balance_update = kwargs.pop('skip_balance_update', False)
        
        if not skip_balance_update:
            from ledger.services import AccountBalanceService
            AccountBalanceService.handle_entry_deleted(self)
        
        super().delete(*args, **kwargs)