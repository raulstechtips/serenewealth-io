from rest_framework import serializers
from ledger.models.category import Category, CategoryGroup, CategoryType


class CategoryGroupSerializer(serializers.ModelSerializer):
    """Serializer for CategoryGroup model."""
    
    type_display = serializers.CharField(source='get_type_display', read_only=True)
    categories_count = serializers.SerializerMethodField()
    
    class Meta:
        model = CategoryGroup
        fields = [
            'id',
            'name',
            'type',
            'type_display',
            'categories_count',
        ]
        read_only_fields = ['id', 'categories_count']
    
    def get_categories_count(self, obj):
        """Get count of categories in this group."""
        return obj.categories.count()


class CategorySerializer(serializers.ModelSerializer):
    """Serializer for Category model."""
    
    # Group information
    group = CategoryGroupSerializer(read_only=True)
    group_id = serializers.UUIDField(write_only=True)
    
    # Type from group (read-only)
    type = serializers.CharField(read_only=True)
    type_display = serializers.SerializerMethodField()
    
    # Count of related entries
    entries_count = serializers.SerializerMethodField()
    
    # Financial insights
    spending_summary = serializers.SerializerMethodField()
    recent_activity = serializers.SerializerMethodField()
    category_insights = serializers.SerializerMethodField()
    
    class Meta:
        model = Category
        fields = [
            'id',
            'name',
            'group',
            'group_id',
            'type',
            'type_display',
            'entries_count',
            'spending_summary',
            'recent_activity',
            'category_insights',
        ]
        read_only_fields = [
            'id', 'type', 'entries_count', 'spending_summary', 
            'recent_activity', 'category_insights'
        ]
    
    def get_type_display(self, obj):
        """Get display name for category type."""
        return obj.group.get_type_display()
    
    def validate_group_id(self, value):
        """Validate the group exists and belongs to the user."""
        user = self.context['request'].user
        try:
            group = CategoryGroup.objects.get(id=value, user=user)
            return value
        except CategoryGroup.DoesNotExist:
            raise serializers.ValidationError("CategoryGroup not found or does not belong to user.")
    
    def create(self, validated_data):
        """Create category with group_id."""
        group_id = validated_data.pop('group_id')
        group = CategoryGroup.objects.get(id=group_id)
        validated_data['group'] = group
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)
    
    def get_entries_count(self, obj):
        """Get count of ledger entries using this category."""
        return obj.entries.count()
    
    def get_spending_summary(self, obj):
        """Get spending summary for this category."""
        from datetime import datetime, timedelta
        from django.db.models import Sum
        
        try:
            thirty_days_ago = datetime.now().date() - timedelta(days=30)
            ninety_days_ago = datetime.now().date() - timedelta(days=90)
            
            # Get spending from entries (direct category assignments)
            recent_entries = obj.entries.filter(effective_date__gte=thirty_days_ago)
            quarterly_entries = obj.entries.filter(effective_date__gte=ninety_days_ago)
            
            # Calculate totals
            recent_entry_total = recent_entries.aggregate(total=Sum('raw_amount'))['total'] or 0
            
            quarterly_entry_total = quarterly_entries.aggregate(total=Sum('raw_amount'))['total'] or 0
            
            recent_total = recent_entry_total
            quarterly_total = quarterly_entry_total
            
            # Calculate averages
            recent_avg = recent_total / 30 if recent_total > 0 else 0
            quarterly_avg = quarterly_total / 90 if quarterly_total > 0 else 0
            
            return {
                'last_30_days': str(recent_total),
                'last_90_days': str(quarterly_total),
                'daily_average_30d': str(recent_avg),
                'daily_average_90d': str(quarterly_avg),
                'transaction_count_30d': recent_entries.count(),
                'transaction_count_90d': quarterly_entries.count(),
            }
        except Exception:
            return {
                'last_30_days': '0',
                'last_90_days': '0',
                'daily_average_30d': '0',
                'daily_average_90d': '0',
                'transaction_count_30d': 0,
                'transaction_count_90d': 0,
            }
    
    def get_recent_activity(self, obj):
        """Get recent activity for this category."""
        from itertools import chain
        from operator import attrgetter
        
        try:
            # Get recent entries
            recent_entries = obj.entries.order_by('-effective_date')[:3]
            
            activity = []
            
            # Add entry activities
            for entry in recent_entries:
                activity.append({
                    'type': 'entry',
                    'id': str(entry.id),
                    'date': entry.effective_date,
                    'description': entry.description,
                    'amount': str(entry.raw_amount),
                    'account_name': entry.account.name,
                })
            
            # Sort by date (most recent first) and limit to 5
            activity.sort(key=lambda x: x['date'], reverse=True)
            return activity[:5]
        except Exception:
            return []
    
    def get_category_insights(self, obj):
        """Get insights and trends for this category."""
        from datetime import datetime, timedelta
        from django.db.models import Sum
        
        try:
            # Compare current month vs previous month
            today = datetime.now().date()
            current_month_start = today.replace(day=1)
            
            # Previous month
            if current_month_start.month == 1:
                prev_month_start = current_month_start.replace(year=current_month_start.year - 1, month=12)
            else:
                prev_month_start = current_month_start.replace(month=current_month_start.month - 1)
            
            # Current month spending
            current_entries = obj.entries.filter(effective_date__gte=current_month_start)
            
            current_entry_total = current_entries.aggregate(total=Sum('raw_amount'))['total'] or 0
            current_total = current_entry_total
            
            # Previous month spending
            prev_entries = obj.entries.filter(
                effective_date__gte=prev_month_start,
                effective_date__lt=current_month_start
            )
            
            prev_entry_total = prev_entries.aggregate(total=Sum('raw_amount'))['total'] or 0
            prev_total = prev_entry_total
            
            # Calculate trend
            if prev_total > 0:
                change_percent = ((current_total - prev_total) / prev_total) * 100
                if change_percent > 10:
                    trend = 'increasing'
                elif change_percent < -10:
                    trend = 'decreasing'
                else:
                    trend = 'stable'
            else:
                trend = 'new' if current_total > 0 else 'inactive'
                change_percent = 0
            
            # Category usage patterns
            all_entries = obj.entries.all()
            
            # Most common accounts for this category
            account_usage = {}
            for entry in all_entries:
                account_name = entry.account.name
                account_usage[account_name] = account_usage.get(account_name, 0) + 1
            
            top_accounts = sorted(account_usage.items(), key=lambda x: x[1], reverse=True)[:3]
            
            return {
                'spending_trend': trend,
                'month_over_month_change': f"{change_percent:.1f}%",
                'current_month_total': str(current_total),
                'previous_month_total': str(prev_total),
                'top_accounts': [{'name': name, 'usage_count': count} for name, count in top_accounts],
                'is_active': current_total > 0 or prev_total > 0,
                'category_type_context': obj.type,
            }
        except Exception:
            return {
                'spending_trend': 'unknown',
                'month_over_month_change': '0%',
                'current_month_total': '0',
                'previous_month_total': '0',
                'top_accounts': [],
                'is_active': False,
                'category_type_context': obj.type,
            }
    
    def validate_name(self, value):
        """Validate category name is unique within group and not empty."""
        if not value or not value.strip():
            raise serializers.ValidationError("Category name cannot be empty.")
        
        return value.strip()


class CategoryListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for category list views."""
    
    group_name = serializers.CharField(source='group.name', read_only=True)
    type = serializers.CharField(read_only=True)
    type_display = serializers.SerializerMethodField()
    
    class Meta:
        model = Category
        fields = [
            'id',
            'name',
            'group_name',
            'type',
            'type_display',
        ]
        read_only_fields = ['id', 'type']
    
    def get_type_display(self, obj):
        """Get display name for category type."""
        return obj.group.get_type_display()
