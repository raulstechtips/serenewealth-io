import uuid
from django.db import models
from django.contrib.auth.models import User
from decimal import Decimal


class Currency(models.TextChoices):
    USD = "USD", "USD"
    # add later as needed

class AccountType(models.TextChoices):
    ASSET = "ASSET", "Asset"
    LIABILITY = "LIABILITY", "Liability"

class AccountSubtype(models.TextChoices):
    CHECKING = "CHECKING", "Checking"
    SAVINGS = "SAVINGS", "Savings"
    CREDIT = "CREDIT", "Credit"
    LOAN = "LOAN", "Loan"
    INVESTMENT = "INVESTMENT", "Investment"

class Account(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="accounts")
    name = models.CharField(max_length=255)
    type = models.CharField(max_length=255, choices=AccountType.choices)
    subtype = models.CharField(max_length=255, choices=AccountSubtype.choices)
    currency = models.CharField(max_length=255, choices=Currency.choices, default=Currency.USD)
    
    # Fast-path caches (recomputed by your services)
    cached_actual_balance = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal("0.00"))

    # Basic falgs for behavior differences
    credit_limit = models.DecimalField(max_digits=18, decimal_places=2, null=True, blank=True)
    interest_rate_apr = models.DecimalField(max_digits=8, decimal_places=5, null=True, blank=True)
    
    class Meta:
        unique_together = [["user", "name"]]

    def __str__(self):
        return f"{self.name} ({self.subtype})"
    
    def balance(self, as_of=None):
        from ledger.models.ledger import LedgerEntry
        qs = LedgerEntry.objects.filter(account=self)
        if as_of:
            qs = qs.filter(effective_date__lte=as_of)
        actual = qs.aggregate(models.Sum("signed_amount"))["signed_amount__sum"] or Decimal("0.00")
        return actual
