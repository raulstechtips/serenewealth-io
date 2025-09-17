import uuid
from django.db import models
from decimal import Decimal
from ledger.models.account import (
    Account,
)


class Statement(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    account = models.ForeignKey(Account, on_delete=models.CASCADE, related_name="statements")
    period_start = models.DateField()
    period_end = models.DateField()
    opening_balance = models.DecimalField(max_digits=18, decimal_places=2)
    closing_balance = models.DecimalField(max_digits=18, decimal_places=2)

    def __str__(self):
        return f"{self.account} - [{self.period_start} - {self.period_end}]"
    
    def process_statement_batch(self):
        """
        Process all statement lines in batch using AccountBalanceService.
        This is much more efficient than processing lines individually.
        
        Returns:
            List of created LedgerEntry objects
        """
        from ledger.services import AccountBalanceService
        return AccountBalanceService.process_statement_batch(self, self.closing_balance)
    
    class Meta:
        unique_together = ("account", "period_start", "period_end")

class StatementLine(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    statement = models.ForeignKey(Statement, on_delete=models.CASCADE, related_name="lines")
    posted_at = models.DateTimeField()
    amount = models.DecimalField(max_digits=18, decimal_places=2)
    description = models.CharField(max_length=255, blank=True)
    external_id = models.CharField(max_length=255, blank=True) # fit for dedupe later
    
    # link to any ledger entry that this line matched
    matched_entry = models.OneToOneField('ledger.LedgerEntry', on_delete=models.SET_NULL, null=True, blank=True, related_name="matched_statement_line")
    
    def __str__(self):
        return f"{self.statement} - {self.posted_at.date()} - {self.amount}"
    
    def realize(self):
        """
        Create (or ensure) the ledger entry for this statement line.
        If it matched a ledger entry, mark the ledger entry as matched (so it stops contributing to ledger balance).
        """
        from ledger.models.ledger import LedgerEntry  # local import to avoid circular at import time
        entry, created = LedgerEntry.objects.get_or_create(
            account=self.statement.account,
            source_statement_line=self,
            defaults=dict(
                effective_date=self.posted_at.date(),
                raw_amount=self.amount,
                # amount sign normalized by account type
                signed_amount=LedgerEntry.normalize_signed_amount(self.statement.account, self.amount),
                description=self.description,
            )
        )
        if self.matched_entry and not self.matched_entry.is_matched:
            self.matched_entry.is_matched = True
            self.matched_entry.save(update_fields=["is_matched"])
        return entry
