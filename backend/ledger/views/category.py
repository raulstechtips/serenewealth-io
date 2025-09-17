from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.db.models import Count, Sum

from ledger.models import Category, CategoryGroup
from ledger.serializers import CategorySerializer, CategoryListSerializer, CategoryGroupSerializer


class CategoryGroupViewSet(viewsets.ModelViewSet):
    """
    ViewSet for CategoryGroup model providing CRUD operations.
    
    Provides:
    - List category groups with filtering and search
    - Create new category groups
    - Retrieve category group details
    - Update category group information
    - Delete category groups
    """
    queryset = CategoryGroup.objects.all()
    serializer_class = CategoryGroupSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['type']
    search_fields = ['name']
    ordering_fields = ['name', 'type']
    ordering = ['type', 'name']
    
    def get_queryset(self):
        """Filter by current user."""
        return CategoryGroup.objects.filter(user=self.request.user)
    
    def perform_create(self, serializer):
        """Automatically set the user when creating."""
        serializer.save(user=self.request.user)


class CategoryViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Category model providing CRUD operations.
    
    Provides:
    - List categories with filtering and search
    - Create new categories
    - Retrieve category details
    - Update category information
    - Delete categories
    - Custom actions for category usage statistics
    """
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['group__type']
    search_fields = ['name', 'group__name']
    ordering_fields = ['name', 'group__type', 'group__name']
    ordering = ['group__type', 'name']
    
    def get_serializer_class(self):
        """Use different serializers for list vs detail views."""
        if self.action == 'list':
            return CategoryListSerializer
        return CategorySerializer
    
    def get_queryset(self):
        """Optimize queryset for different actions."""
        queryset = Category.objects.select_related('group').filter(user=self.request.user)
        
        # For list view, prefetch related counts
        if self.action == 'list':
            queryset = queryset.annotate(
                entries_count=Count('entries'),
            )
        
        return queryset
    
    def perform_create(self, serializer):
        """Automatically set the user when creating."""
        serializer.save(user=self.request.user)
    
    @action(detail=True, methods=['get'])
    def usage_stats(self, request, pk=None):
        """Get usage statistics for a specific category."""
        category = self.get_object()
        
        # Get entry statistics
        entries = category.entries.all()
        entry_stats = entries.aggregate(
            count=Count('id'),
            total_amount=Sum('raw_amount')
        )
        
        # Recent usage
        recent_entries = entries.order_by('-effective_date')[:5]
        
        recent_usage = []
        
        # Add recent entries
        for entry in recent_entries:
            recent_usage.append({
                'type': 'entry',
                'date': entry.effective_date,
                'description': entry.description,
                'amount': str(entry.raw_amount),
                'account': entry.account.name,
                'entry_id': str(entry.id)
            })
        
        # Sort by date
        recent_usage.sort(key=lambda x: x['date'], reverse=True)
        
        return Response({
            'category_id': str(category.id),
            'category_name': category.name,
            'category_type': category.type,
            'entry_stats': {
                'count': entry_stats['count'] or 0,
                'total_amount': str(entry_stats['total_amount'] or 0)
            },
            'recent_usage': recent_usage[:10]  # Limit to 10 most recent
        })
    
    @action(detail=False, methods=['get'])
    def by_type(self, request):
        """Get categories grouped by type."""
        categories = Category.objects.select_related('group').filter(user=request.user).order_by('group__type', 'name')
        
        grouped = {}
        for category in categories:
            if category.type not in grouped:
                grouped[category.type] = []
            
            grouped[category.type].append({
                'id': str(category.id),
                'name': category.name,
                'group_name': category.group.name,
            })
        
        return Response(grouped)
    
    def destroy(self, request, *args, **kwargs):
        """Override destroy to check for related entries."""
        category = self.get_object()
        
        # Check if category has any entries
        if category.entries.exists():
            return Response(
                {'error': 'Cannot delete category with existing entries. Please reassign or delete entries first.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        return super().destroy(request, *args, **kwargs)
