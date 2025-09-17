from rest_framework import serializers
from ledger.models import Statement, StatementLine, Account
from decimal import Decimal


class StatementLineSerializer(serializers.ModelSerializer):
    """Serializer for StatementLine model."""
    
    class Meta:
        model = StatementLine
        fields = [
            'id',
            'posted_at',
            'amount',
            'description',
            'external_id',
            'matched_entry',
        ]
        read_only_fields = ['id', 'matched_entry']


class StatementSerializer(serializers.ModelSerializer):
    """Serializer for Statement model with nested lines."""
    
    lines = StatementLineSerializer(many=True, read_only=True)
    account_name = serializers.CharField(source='account.name', read_only=True)
    
    class Meta:
        model = Statement
        fields = [
            'id',
            'account',
            'account_name',
            'period_start',
            'period_end',
            'opening_balance',
            'closing_balance',
            'lines',
        ]
        read_only_fields = ['id', 'account_name', 'lines']
    
    def validate_account(self, value):
        """Validate account exists."""
        if not Account.objects.filter(id=value.id).exists():
            raise serializers.ValidationError("Invalid account.")
        return value
    
    def validate(self, attrs):
        """Validate statement constraints."""
        period_start = attrs.get('period_start')
        period_end = attrs.get('period_end')
        
        if period_start and period_end and period_start > period_end:
            raise serializers.ValidationError(
                "Period start date must be before or equal to period end date."
            )
        
        return attrs


class StatementCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating statements with lines."""
    
    lines_data = serializers.ListField(
        child=serializers.DictField(),
        write_only=True,
        help_text="List of statement line data"
    )
    
    class Meta:
        model = Statement
        fields = [
            'account',
            'period_start',
            'period_end',
            'opening_balance',
            'closing_balance',
            'lines_data',
        ]
    
    def validate_account(self, value):
        """Validate account exists."""
        if not Account.objects.filter(id=value.id).exists():
            raise serializers.ValidationError("Invalid account.")
        return value
    
    def validate_lines_data(self, value):
        """Validate lines data format."""
        if not value:
            raise serializers.ValidationError("At least one statement line is required.")
        
        required_fields = ['posted_at', 'amount', 'description']
        for i, line_data in enumerate(value):
            for field in required_fields:
                if field not in line_data:
                    raise serializers.ValidationError(
                        f"Line {i+1}: Missing required field '{field}'"
                    )
            
            # Validate amount is a valid decimal
            try:
                Decimal(str(line_data['amount']))
            except (ValueError, TypeError):
                raise serializers.ValidationError(
                    f"Line {i+1}: Invalid amount format"
                )
        
        return value
    
    def create(self, validated_data):
        """Create statement with lines."""
        lines_data = validated_data.pop('lines_data')
        
        # Create statement
        statement = Statement.objects.create(**validated_data)
        
        # Create statement lines
        lines = []
        for line_data in lines_data:
            lines.append(StatementLine(
                statement=statement,
                posted_at=line_data['posted_at'],
                amount=Decimal(str(line_data['amount'])),
                description=line_data.get('description', ''),
                external_id=line_data.get('external_id', ''),
            ))
        
        StatementLine.objects.bulk_create(lines)
        
        return statement


class StatementProcessSerializer(serializers.Serializer):
    """Serializer for processing statement (creating ledger entries)."""
    
    verify_balance = serializers.BooleanField(
        default=True,
        help_text="Whether to verify the closing balance matches calculated balance"
    )
    
    def validate(self, attrs):
        """Validate that statement can be processed."""
        statement = self.context['statement']
        
        # Check if statement has lines
        if not statement.lines.exists():
            raise serializers.ValidationError("Statement has no lines to process.")
        
        # Check if any lines are already processed
        processed_lines = statement.lines.filter(
            actual_ledger_entry__isnull=False
        ).count()
        
        if processed_lines > 0:
            raise serializers.ValidationError(
                f"Statement has {processed_lines} lines already processed. "
                "Cannot reprocess statement."
            )
        
        return attrs
