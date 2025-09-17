import uuid
from decimal import Decimal
from django.core.exceptions import ValidationError
from django.db import models
from ledger.models.ledger import LedgerEntry
from ledger.models.account import AccountType

def get_transfer_category(user):
    """
    Get or create a TRANSFER-type category for the user.
    This is used as the neutral category for the from_entry in transfers.
    """
    from ledger.models.category import Category, CategoryGroup, CategoryType
    
    # Get or create the Transfer category group
    transfer_group, _ = CategoryGroup.objects.get_or_create(
        user=user,
        name="Transfer",
        type=CategoryType.TRANSFER,
    )
    
    # Get or create the Transfer category
    transfer_category, _ = Category.objects.get_or_create(
        user=user,
        group=transfer_group,
        name="Transfer",
    )
    
    return transfer_category

class Transfer(models.Model):
    """
    Represents a money move between two accounts (planned or actual).
    We encode it as a link between two LedgerEntries:
      - from_entry.raw_amount should be NEGATIVE (outflow)
      - to_entry.raw_amount   should be POSITIVE (inflow)
      - abs(raw) must match
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    from_entry = models.OneToOneField(LedgerEntry, on_delete=models.CASCADE, related_name="transfer_from")
    to_entry = models.OneToOneField(LedgerEntry, on_delete=models.CASCADE, related_name="transfer_to")

    def clean(self):
        if self.from_entry.account_id == self.to_entry.account_id:
            raise ValidationError("Transfer must link two different accounts.")
        if not (self.from_entry.raw_amount < 0 and self.to_entry.raw_amount > 0):
            raise ValidationError("Transfer requires from_entry.raw < 0 and to_entry.raw > 0.")
        if abs(Decimal(self.from_entry.raw_amount)) != abs(Decimal(self.to_entry.raw_amount)):
            raise ValidationError("Transfer amounts must match in magnitude (abs(raw) equal).")
    
    @classmethod
    def create_transfer(cls, from_account, to_account, amount, effective_date, purpose_category, user, description=""):
        """
        Create a transfer between two accounts with proper balance handling.
        
        Args:
            from_account: Source account (will have negative entry)
            to_account: Destination account (will have positive entry)
            amount: Transfer amount (positive value)
            effective_date: Date of the transfer
            purpose_category: Category instance for the to_entry (meaningful categorization)
            user: User instance for creating the neutral transfer category
            description: Optional description
            
        Returns:
            Transfer object with both entries created
        """
        from ledger.services import AccountBalanceService
        from django.db import transaction
        
        if amount <= 0:
            raise ValidationError("Transfer amount must be positive")
        
        if from_account.id == to_account.id:
            raise ValidationError("Cannot transfer to the same account")
        
        # Get the neutral transfer category for the from_entry
        transfer_category = get_transfer_category(user)
        
        with transaction.atomic():
            # Create the two ledger entries; balance updates will occur in LedgerEntry.save()
            from_entry = LedgerEntry.objects.create(
                account=from_account,
                effective_date=effective_date,
                raw_amount=-amount,  # Negative for outflow
                signed_amount=LedgerEntry.normalize_signed_amount(from_account, -amount),
                description=description or f"Transfer to {to_account.name}",
                category=transfer_category,
            )

            to_entry = LedgerEntry.objects.create(
                account=to_account,
                effective_date=effective_date,
                raw_amount=amount,  # Positive for inflow
                signed_amount=LedgerEntry.normalize_signed_amount(to_account, amount),
                description=description or f"Transfer from {from_account.name}",
                category=purpose_category,
            )

            transfer_kwargs = {
                'from_entry': from_entry,
                'to_entry': to_entry,
            }
            if hasattr(cls, 'category'):
                transfer_kwargs['category'] = purpose_category

            transfer = cls.objects.create(**transfer_kwargs)

            return transfer
    
    def delete(self, *args, **kwargs):
        """Override delete to handle balance updates for both accounts."""
        from ledger.services import AccountBalanceService
        from django.db import transaction
        
        with transaction.atomic():
            # Handle balance updates before deleting
            AccountBalanceService.handle_transfer_deleted(self.from_entry, self.to_entry)
            
            # Delete the transfer (entries will be deleted by CASCADE)
            super().delete(*args, **kwargs)

    def __str__(self):
        return f"Transfer {abs(self.to_entry.raw_amount)} {self.from_entry.account} -> {self.to_entry.account}"
