from rest_framework import serializers
from ledger.models import Account, AccountType, AccountSubtype, Currency
from datetime import datetime, timedelta
from django.db.models import Sum, Count, Q, Max
from decimal import Decimal


class AccountListSerializer(serializers.ModelSerializer):
    """Ultra-fast serializer for account lists - NO computed fields that require additional queries."""
    
    current_balance = serializers.CharField(source='cached_actual_balance', read_only=True)
    type_display = serializers.CharField(source='get_type_display', read_only=True)
    subtype_display = serializers.CharField(source='get_subtype_display', read_only=True)
    
    # Basic stats from annotations (no additional queries)
    entries_count = serializers.IntegerField(read_only=True)
    last_transaction_date = serializers.DateField(read_only=True)
    unmatched_count = serializers.IntegerField(read_only=True)
    
    class Meta:
        model = Account
        fields = [
            'id',
            'name',
            'type',
            'type_display',
            'subtype',
            'subtype_display',
            'currency',
            'current_balance',
            'entries_count',
            'last_transaction_date',
            'unmatched_count',
        ]
        read_only_fields = [
            'id', 'current_balance', 'entries_count', 
            'last_transaction_date', 'unmatched_count'
        ]


class AccountSerializer(serializers.ModelSerializer):
    """Standard account data without expensive computations - for basic detail views."""
    
    current_balance = serializers.CharField(source='cached_actual_balance', read_only=True)
    type_display = serializers.CharField(source='get_type_display', read_only=True)
    subtype_display = serializers.CharField(source='get_subtype_display', read_only=True)
    currency_display = serializers.CharField(source='get_currency_display', read_only=True)
    
    # Opening balance field for account creation - write-only
    opening_balance = serializers.DecimalField(
        max_digits=18, 
        decimal_places=2, 
        default=Decimal("0.00"),
        write_only=True,
        required=False,
        help_text="Initial balance for the account. Will create an opening balance ledger entry."
    )
    
    class Meta:
        model = Account
        fields = [
            'id',
            'name',
            'type',
            'type_display',
            'subtype',
            'subtype_display',
            'currency',
            'currency_display',
            'cached_actual_balance',
            'current_balance',
            'credit_limit',
            'interest_rate_apr',
            'opening_balance',
        ]
        read_only_fields = ['id', 'cached_actual_balance', 'current_balance']
    
    def validate_type(self, value):
        """Validate account type is a valid choice."""
        if value not in [choice[0] for choice in AccountType.choices]:
            raise serializers.ValidationError(f"Invalid account type: {value}")
        return value
    
    def validate_subtype(self, value):
        """Validate account subtype is a valid choice."""
        if value not in [choice[0] for choice in AccountSubtype.choices]:
            raise serializers.ValidationError(f"Invalid account subtype: {value}")
        return value
    
    def validate_currency(self, value):
        """Validate currency is a valid choice."""
        if value not in [choice[0] for choice in Currency.choices]:
            raise serializers.ValidationError(f"Invalid currency: {value}")
        return value


class AccountFinancialSummarySerializer(serializers.Serializer):
    """Serializer for financial summary data from dedicated endpoints."""
    
    account_id = serializers.UUIDField()
    account_name = serializers.CharField()
    account_type = serializers.CharField()
    current_balance = serializers.CharField()
    
    summary = serializers.DictField(child=serializers.CharField())


class AccountHealthSerializer(serializers.Serializer):
    """Serializer for account health data from dedicated endpoints."""
    
    account_id = serializers.UUIDField()
    health = serializers.DictField()


class AccountActivitySerializer(serializers.Serializer):
    """Serializer for account activity data from dedicated endpoints."""
    
    account_id = serializers.UUIDField()
    activity = serializers.ListField(child=serializers.DictField())


class AccountDashboardSerializer(serializers.Serializer):
    """Complete dashboard data serializer."""
    
    account = serializers.DictField()
    financial_summary = serializers.DictField()
    health = serializers.DictField()
    recent_activity = serializers.ListField(child=serializers.DictField())
