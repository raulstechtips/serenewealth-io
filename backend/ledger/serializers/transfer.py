from rest_framework import serializers
from ledger.models import Transfer, Account, LedgerEntry, Category
from ledger.serializers.account import AccountListSerializer
from ledger.serializers.ledger import LedgerEntryListSerializer
from decimal import Decimal
from datetime import date


class TransferSerializer(serializers.ModelSerializer):
    """Serializer for Transfer model with nested relationships."""
    
    # Nested related objects for detailed view
    from_entry_detail = LedgerEntryListSerializer(source='from_entry', read_only=True)
    to_entry_detail = LedgerEntryListSerializer(source='to_entry', read_only=True)
    from_account_detail = AccountListSerializer(source='from_entry.account', read_only=True)
    to_account_detail = AccountListSerializer(source='to_entry.account', read_only=True)
    
    # Computed fields
    transfer_amount = serializers.SerializerMethodField()
    effective_date = serializers.SerializerMethodField()
    description = serializers.SerializerMethodField()
    
    class Meta:
        model = Transfer
        fields = [
            'id',
            'from_entry',
            'to_entry',
            'from_entry_detail',
            'to_entry_detail',
            'from_account_detail',
            'to_account_detail',
            'transfer_amount',
            'effective_date',
            'description',
        ]
        read_only_fields = [
            'id', 'transfer_amount', 'effective_date', 
            'description', 'from_entry_detail', 'to_entry_detail', 
            'from_account_detail', 'to_account_detail'
        ]
    
    def get_transfer_amount(self, obj):
        """Get the transfer amount (positive value)."""
        return str(abs(obj.to_entry.raw_amount))
    
    def get_effective_date(self, obj):
        """Get the effective date from the entries."""
        return obj.from_entry.effective_date
    
    def get_description(self, obj):
        """Get the description from the from_entry."""
        return obj.from_entry.description


class TransferListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for transfer list views."""
    
    from_account_name = serializers.CharField(source='from_entry.account.name', read_only=True)
    to_account_name = serializers.CharField(source='to_entry.account.name', read_only=True)
    from_account_id = serializers.UUIDField(source='from_entry.account.id', read_only=True)
    to_account_id = serializers.UUIDField(source='to_entry.account.id', read_only=True)
    transfer_amount = serializers.SerializerMethodField()
    effective_date = serializers.SerializerMethodField()
    description = serializers.SerializerMethodField()
    
    class Meta:
        model = Transfer
        fields = [
            'id',
            'from_account_id',
            'from_account_name',
            'to_account_id',
            'to_account_name',
            'transfer_amount',
            'effective_date',
            'description',
        ]
        read_only_fields = [
            'id', 'from_account_id', 'from_account_name', 'to_account_id', 
            'to_account_name', 'transfer_amount', 'effective_date', 
            'description',
        ]
    
    def get_transfer_amount(self, obj):
        """Get the transfer amount (positive value)."""
        return str(abs(obj.to_entry.raw_amount))
    
    def get_effective_date(self, obj):
        """Get the effective date from the entries."""
        return obj.from_entry.effective_date
    
    def get_description(self, obj):
        """Get the description from the from_entry."""
        return obj.from_entry.description


class TransferCreateSerializer(serializers.Serializer):
    """Serializer for creating transfers using the Transfer.create_transfer() method."""
    
    from_account = serializers.UUIDField(help_text="Source account ID")
    to_account = serializers.UUIDField(help_text="Destination account ID")
    amount = serializers.DecimalField(
        max_digits=18, 
        decimal_places=2,
        help_text="Transfer amount (positive value)"
    )
    effective_date = serializers.DateField(
        default=date.today,
        help_text="Date of the transfer"
    )
    purpose_category = serializers.UUIDField(help_text="Category ID for the destination entry (purpose of transfer)")
    description = serializers.CharField(
        max_length=255,
        required=False,
        allow_blank=True,
        help_text="Optional description for the transfer"
    )
    
    def validate_from_account(self, value):
        """Validate from_account exists."""
        try:
            return Account.objects.get(id=value)
        except Account.DoesNotExist:
            raise serializers.ValidationError("Source account not found.")
    
    def validate_to_account(self, value):
        """Validate to_account exists."""
        try:
            return Account.objects.get(id=value)
        except Account.DoesNotExist:
            raise serializers.ValidationError("Destination account not found.")
    
    def validate_amount(self, value):
        """Validate amount is positive."""
        if value <= 0:
            raise serializers.ValidationError("Transfer amount must be positive.")
        return value
    
    def validate_purpose_category(self, value):
        """Validate purpose_category exists."""
        try:
            return Category.objects.get(id=value)
        except Category.DoesNotExist:
            raise serializers.ValidationError("Purpose category not found.")
    
    def validate(self, attrs):
        """Validate transfer constraints."""
        from_account = attrs['from_account']
        to_account = attrs['to_account']
        
        if from_account.id == to_account.id:
            raise serializers.ValidationError("Cannot transfer to the same account.")
        
        return attrs
    
    def create(self, validated_data):
        """Create transfer using Transfer.create_transfer() method."""
        # Note: user will be passed via context from the view
        user = self.context['request'].user
        return Transfer.create_transfer(
            from_account=validated_data['from_account'],
            to_account=validated_data['to_account'],
            amount=validated_data['amount'],
            effective_date=validated_data['effective_date'],
            purpose_category=validated_data['purpose_category'],
            user=user,
            description=validated_data.get('description', '')
        )


class TransferUpdateSerializer(serializers.Serializer):
    """Serializer for updating transfer descriptions."""
    
    description = serializers.CharField(
        max_length=255,
        required=False,
        allow_blank=True,
        help_text="Update description for both transfer entries"
    )
    
    def update(self, instance, validated_data):
        """Update transfer description."""
        description = validated_data.get('description')
        
        if description is not None:
            # Update descriptions for both entries
            instance.from_entry.description = description
            instance.from_entry.save(update_fields=['description'])
            
            instance.to_entry.description = description
            instance.to_entry.save(update_fields=['description'])
        
        return instance


class TransferValidationSerializer(serializers.Serializer):
    """Serializer for transfer validation without creation."""
    
    from_account = serializers.UUIDField()
    to_account = serializers.UUIDField()
    amount = serializers.DecimalField(max_digits=18, decimal_places=2)
    purpose_category = serializers.UUIDField(required=False)
    
    def validate_from_account(self, value):
        """Validate from_account exists."""
        try:
            return Account.objects.get(id=value)
        except Account.DoesNotExist:
            raise serializers.ValidationError("Source account not found.")
    
    def validate_to_account(self, value):
        """Validate to_account exists."""
        try:
            return Account.objects.get(id=value)
        except Account.DoesNotExist:
            raise serializers.ValidationError("Destination account not found.")
    
    def validate_amount(self, value):
        """Validate amount is positive."""
        if value <= 0:
            raise serializers.ValidationError("Transfer amount must be positive.")
        return value
    
    def validate(self, attrs):
        """Validate transfer constraints and return validation result."""
        from_account = attrs['from_account']
        to_account = attrs['to_account']
        amount = attrs['amount']
        
        validation_result = {
            'is_valid': True,
            'warnings': [],
            'errors': []
        }
        
        # Check same account
        if from_account.id == to_account.id:
            validation_result['is_valid'] = False
            validation_result['errors'].append("Cannot transfer to the same account.")
        
        validation_result['from_account_balance'] = from_account.cached_actual_balance
        validation_result['to_account_balance'] = to_account.cached_actual_balance
        
        # Calculate resulting balances
        if from_account.type == 'ASSET':
            validation_result['from_account_balance_after'] = from_account.cached_actual_balance - amount
        else:  # LIABILITY
            validation_result['from_account_balance_after'] = from_account.cached_actual_balance - amount
        
        if to_account.type == 'ASSET':
            validation_result['to_account_balance_after'] = to_account.cached_actual_balance + amount
        else:  # LIABILITY
            validation_result['to_account_balance_after'] = to_account.cached_actual_balance + amount
        
        attrs['validation_result'] = validation_result
        return attrs
