from django.urls import path, include
from rest_framework.routers import DefaultRouter
from ledger.views import (
    AccountViewSet,
    CategoryViewSet,
    CategoryGroupViewSet,
    LedgerEntryViewSet,
    StatementViewSet,
    TransferViewSet,
    current_user,
)

# Create a router and register our viewsets with it
router = DefaultRouter()
router.register(r'accounts', AccountViewSet, basename='account')
router.register(r'categories', CategoryViewSet, basename='category')
router.register(r'category-groups', CategoryGroupViewSet, basename='categorygroup')
router.register(r'entries', LedgerEntryViewSet, basename='ledgerentry')
router.register(r'statements', StatementViewSet, basename='statement')
router.register(r'transfers', TransferViewSet, basename='transfer')

# The API URLs are now determined automatically by the router
urlpatterns = [
    path('user/me/', current_user, name='current-user'),
    path('ledger/', include(router.urls)),
]

# This will create the following URL patterns:
# 
# Accounts:
# GET    /api/v1/ledger/accounts/                     - List all accounts
# POST   /api/v1/ledger/accounts/                     - Create new account
# GET    /api/v1/ledger/accounts/{id}/                - Get account details
# PUT    /api/v1/ledger/accounts/{id}/                - Update account
# PATCH  /api/v1/ledger/accounts/{id}/                - Partial update account
# DELETE /api/v1/ledger/accounts/{id}/                - Delete account
# GET    /api/v1/ledger/accounts/{id}/balance_history/ - Get account balance history
# GET    /api/v1/ledger/accounts/{id}/recent_entries/  - Get recent entries for account
#
# Categories:
# GET    /api/v1/ledger/categories/                   - List all categories
# POST   /api/v1/ledger/categories/                   - Create new category
# GET    /api/v1/ledger/categories/{id}/              - Get category details
# PUT    /api/v1/ledger/categories/{id}/              - Update category
# PATCH  /api/v1/ledger/categories/{id}/              - Partial update category
# DELETE /api/v1/ledger/categories/{id}/              - Delete category
# GET    /api/v1/ledger/categories/{id}/usage_stats/  - Get category usage statistics
# GET    /api/v1/ledger/categories/by_type/           - Get categories grouped by type
#
# Ledger Entries:
# GET    /api/v1/ledger/entries/                      - List all entries
# POST   /api/v1/ledger/entries/                      - Create new entry
# GET    /api/v1/ledger/entries/{id}/                 - Get entry details
# PUT    /api/v1/ledger/entries/{id}/                 - Update entry
# PATCH  /api/v1/ledger/entries/{id}/                 - Partial update entry
# DELETE /api/v1/ledger/entries/{id}/                 - Delete entry
# GET    /api/v1/ledger/entries/recent/               - Get recent entries
# GET    /api/v1/ledger/entries/summary/              - Get entries summary statistics
# GET    /api/v1/ledger/entries/by_category/          - Get entries grouped by category
#
# Transfers:
# GET    /api/v1/ledger/transfers/                    - List all transfers
# POST   /api/v1/ledger/transfers/                    - Create new transfer
# GET    /api/v1/ledger/transfers/{id}/               - Get transfer details
# PUT    /api/v1/ledger/transfers/{id}/               - Update transfer
# PATCH  /api/v1/ledger/transfers/{id}/               - Partial update transfer
# DELETE /api/v1/ledger/transfers/{id}/               - Delete transfer
# POST   /api/v1/ledger/transfers/validate/           - Validate transfer without creation
# GET    /api/v1/ledger/transfers/recent/             - Get recent transfers
# GET    /api/v1/ledger/transfers/summary/            - Get transfer summary statistics
# GET    /api/v1/ledger/transfers/by_account/         - Get transfers by account ID
# GET    /api/v1/ledger/transfers/{id}/entries/       - Get ledger entries for transfer
#
# Statements:
# GET    /api/v1/ledger/statements/                   - List all statements
# POST   /api/v1/ledger/statements/                   - Create new statement
# GET    /api/v1/ledger/statements/{id}/              - Get statement details
# PUT    /api/v1/ledger/statements/{id}/              - Update statement
# PATCH  /api/v1/ledger/statements/{id}/              - Partial update statement
# DELETE /api/v1/ledger/statements/{id}/              - Delete statement
# POST   /api/v1/ledger/statements/{id}/process/      - Process statement (batch)
# GET    /api/v1/ledger/statements/{id}/lines/        - Get statement lines
# GET    /api/v1/ledger/statements/{id}/summary/      - Get statement summary
