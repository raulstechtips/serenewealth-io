from rest_framework import serializers
from ledger.models import LedgerEntry, Account, Category
from .account import AccountListSerializer
from .category import CategoryListSerializer


class LedgerEntrySerializer(serializers.ModelSerializer):
    """Serializer for LedgerEntry model with nested relationships."""
    
    # Nested related objects for detailed view
    account_detail = AccountListSerializer(source='account', read_only=True)
    category_detail = CategoryListSerializer(source='category', read_only=True)
    
    # Computed fields
    is_transfer = serializers.SerializerMethodField()
    transfer_details = serializers.SerializerMethodField()
    running_balance = serializers.SerializerMethodField()
    reconciliation_status = serializers.SerializerMethodField()
    effective_category = serializers.SerializerMethodField()
    
    class Meta:
        model = LedgerEntry
        fields = [
            'id',
            'account',
            'account_detail',
            'effective_date',
            'description',
            'raw_amount',
            'signed_amount',
            'category',
            'category_detail',
            'effective_category',
            'is_matched',
            'source_statement_line',
            'reconciliation_status',
            'is_transfer',
            'transfer_details',
            'running_balance',
        ]
        read_only_fields = [
            'id', 'signed_amount', 'is_matched',
            'is_transfer', 'transfer_details', 'running_balance', 'reconciliation_status',
            'effective_category'
        ]
    
    def get_is_transfer(self, obj):
        """Check if entry is part of a transfer."""
        return (
            hasattr(obj, 'transfer_from') and obj.transfer_from is not None
            or hasattr(obj, 'transfer_to') and obj.transfer_to is not None
        )
    
    def get_transfer_details(self, obj):
        """Get detailed transfer information if this is a transfer."""
        if not self.get_is_transfer(obj):
            return None
        
        try:
            if hasattr(obj, 'transfer_from') and obj.transfer_from:
                # This is the 'from' entry
                transfer = obj.transfer_from
                other_entry = transfer.to_entry
                direction = 'outgoing'
            elif hasattr(obj, 'transfer_to') and obj.transfer_to:
                # This is the 'to' entry
                transfer = obj.transfer_to
                other_entry = transfer.from_entry
                direction = 'incoming'
            else:
                return None
            
            return {
                'transfer_id': str(transfer.id),
                'direction': direction,
                'other_account_id': str(other_entry.account.id),
                'other_account_name': other_entry.account.name,
                'transfer_amount': str(abs(obj.raw_amount)),
            }
        except Exception:
            return None
    
    def get_running_balance(self, obj):
        """Calculate running balance up to this entry for the account."""
        if not obj.pk or not obj.account:
            return None
        
        try:
            # Get all entries for this account up to and including this entry's date
            entries = obj.account.entries.filter(
                effective_date__lte=obj.effective_date
            ).exclude(
                effective_date=obj.effective_date,
                id__gt=obj.id  # For entries on same date, include only up to this one
            ).order_by('effective_date', 'id')
            
            # Calculate running total
            balance = sum(entry.signed_amount for entry in entries)
            return str(balance)
        except Exception:
            return None
    
    def get_reconciliation_status(self, obj):
        """Get detailed reconciliation status."""
        status = 'unmatched'
        details = {
            'is_matched': obj.is_matched,
            'statement_line_id': None,
            'statement_reference': None,
        }
        
        if obj.is_matched and obj.source_statement_line:
            status = 'matched'
            details.update({
                'statement_line_id': str(obj.source_statement_line.id),
                'statement_reference': obj.source_statement_line.reference_number,
            })
        elif obj.is_matched:
            status = 'manually_cleared'
        
        return {
            'status': status,
            'details': details
        }
    
    def get_effective_category(self, obj):
        """Get the effective category directly from the category."""
        if obj.category:
            # Direct category
            return {
                'type': 'direct',
                'category_id': str(obj.category.id),
                'category_name': obj.category.name,
                'category_type': obj.category.type,
            }
        else:
            return {
                'type': 'uncategorized',
                'category_id': None,
                'category_name': 'Uncategorized',
            }
    
    def validate_account(self, value):
        """Validate account exists."""
        if not Account.objects.filter(id=value.id).exists():
            raise serializers.ValidationError("Invalid account.")
        return value
    
    def validate_category(self, value):
        """Validate category exists (if provided)."""
        if value and not Category.objects.filter(id=value.id).exists():
            raise serializers.ValidationError("Invalid category.")
        return value
    
    def validate_raw_amount(self, value):
        """Validate raw amount is not zero."""
        if value == 0:
            raise serializers.ValidationError("Raw amount cannot be zero.")
        return value
    
    def validate(self, attrs):
        """Validate entry constraints."""
        # If this is an update, check category constraints
            # For new entries, category is required
        category = attrs.get('category')
        if category is None:
            raise serializers.ValidationError(
                "Category is required for new entries."
            )
        
        return attrs
    
    def create(self, validated_data):
        """Create a new ledger entry with proper signed_amount calculation."""
        account = validated_data['account']
        raw_amount = validated_data['raw_amount']
        
        # Calculate signed_amount based on account type
        signed_amount = LedgerEntry.normalize_signed_amount(account, raw_amount)
        validated_data['signed_amount'] = signed_amount
        
        return super().create(validated_data)
    
    def update(self, instance, validated_data):
        """Update ledger entry, recalculating signed_amount if needed."""
        # If account or raw_amount changed, recalculate signed_amount
        if 'account' in validated_data or 'raw_amount' in validated_data:
            account = validated_data.get('account', instance.account)
            raw_amount = validated_data.get('raw_amount', instance.raw_amount)
            validated_data['signed_amount'] = LedgerEntry.normalize_signed_amount(account, raw_amount)
        
        return super().update(instance, validated_data)


class LedgerEntryListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for ledger entry list views."""
    
    account_name = serializers.CharField(source='account.name', read_only=True)
    account_type = serializers.CharField(source='account.type', read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True)
    category_type = serializers.CharField(source='category.type', read_only=True)
    is_transfer = serializers.SerializerMethodField()
    transfer_direction = serializers.SerializerMethodField()
    other_account_name = serializers.SerializerMethodField()
    reconciliation_status = serializers.SerializerMethodField()
    
    class Meta:
        model = LedgerEntry
        fields = [
            'id',
            'account',
            'account_name',
            'account_type',
            'effective_date',
            'description',
            'raw_amount',
            'signed_amount',
            'category',
            'category_name',
            'category_type',
            'is_transfer',
            'transfer_direction',
            'other_account_name',
            'reconciliation_status',
            'is_matched',
        ]
        read_only_fields = [
            'id', 'signed_amount', 'account_name', 'account_type', 'category_name', 'category_type',
            'is_transfer', 'transfer_direction', 'other_account_name', 
            'reconciliation_status', 'is_matched'
        ]
    
    def get_is_transfer(self, obj):
        """Check if entry is part of a transfer."""
        return (
            hasattr(obj, 'transfer_from') and obj.transfer_from is not None
            or hasattr(obj, 'transfer_to') and obj.transfer_to is not None
        )
    
    def get_transfer_direction(self, obj):
        """Get transfer direction if this is a transfer."""
        if not self.get_is_transfer(obj):
            return None
        
        if hasattr(obj, 'transfer_from') and obj.transfer_from:
            return 'outgoing'
        elif hasattr(obj, 'transfer_to') and obj.transfer_to:
            return 'incoming'
        return None
    
    def get_other_account_name(self, obj):
        """Get the name of the other account if this is a transfer."""
        if not self.get_is_transfer(obj):
            return None
        
        try:
            if hasattr(obj, 'transfer_from') and obj.transfer_from:
                return obj.transfer_from.to_entry.account.name
            elif hasattr(obj, 'transfer_to') and obj.transfer_to:
                return obj.transfer_to.from_entry.account.name
        except Exception:
            pass
        return None
    
    def get_reconciliation_status(self, obj):
        """Get simple reconciliation status for list view."""
        if obj.is_matched and obj.source_statement_line:
            return 'matched'
        elif obj.is_matched:
            return 'manually_cleared'
        else:
            return 'unmatched'


class LedgerEntryCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating ledger entries with minimal fields."""
    
    class Meta:
        model = LedgerEntry
        fields = [
            'account',
            'effective_date',
            'description',
            'raw_amount',
            'category',
        ]
    
    def validate_account(self, value):
        """Validate account exists."""
        if not Account.objects.filter(id=value.id).exists():
            raise serializers.ValidationError("Invalid account.")
        return value
    
    def validate_category(self, value):
        """Validate category exists."""
        if not Category.objects.filter(id=value.id).exists():
            raise serializers.ValidationError("Invalid category.")
        return value
    
    def validate_raw_amount(self, value):
        """Validate raw amount is not zero."""
        if value == 0:
            raise serializers.ValidationError("Raw amount cannot be zero.")
        return value
    
    def create(self, validated_data):
        """Create a new ledger entry with proper signed_amount calculation."""
        account = validated_data['account']
        raw_amount = validated_data['raw_amount']
        
        # Calculate signed_amount based on account type
        signed_amount = LedgerEntry.normalize_signed_amount(account, raw_amount)
        validated_data['signed_amount'] = signed_amount
        
        return super().create(validated_data)
