from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from decimal import Decimal
from datetime import date
import json

from ledger.models import (
    Account, AccountType, AccountSubtype, Currency,
    Category, CategoryType, Transfer
)


class TransferAPITest(TestCase):
    """Test cases for Transfer API endpoints."""
    
    def setUp(self):
        """Set up test data."""
        self.client = APIClient()
        
        # Create test accounts
        self.checking_account = Account.objects.create(
            name="Test Checking",
            type=AccountType.ASSET,
            subtype=AccountSubtype.CHECKING,
            currency=Currency.USD,
            cached_actual_balance=Decimal('1000.00')
        )
        
        self.savings_account = Account.objects.create(
            name="Test Savings",
            type=AccountType.ASSET,
            subtype=AccountSubtype.SAVINGS,
            currency=Currency.USD,
            cached_actual_balance=Decimal('5000.00')
        )
        
        self.credit_account = Account.objects.create(
            name="Test Credit Card",
            type=AccountType.LIABILITY,
            subtype=AccountSubtype.CREDIT,
            currency=Currency.USD,
            cached_actual_balance=Decimal('0.00'),
        )
        
        # Create test category
        self.transfer_category = Category.objects.create(
            name="Transfer",
            type=CategoryType.TRANSFER
        )
    
    def test_create_transfer_api(self):
        """Test creating a transfer via API."""
        transfer_data = {
            'from_account': str(self.checking_account.id),
            'to_account': str(self.savings_account.id),
            'amount': '300.00',
            'effective_date': str(date.today()),
            'description': 'API Transfer Test'
        }
        
        response = self.client.post(
            '/api/v1/ledger/transfers/',
            data=json.dumps(transfer_data),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        # Verify response data
        response_data = response.json()
        self.assertIn('id', response_data)
        self.assertEqual(response_data['transfer_amount'], '300.00')
        self.assertEqual(response_data['effective_date'], str(date.today()))
        self.assertEqual(response_data['description'], 'API Transfer Test')
        
        # Verify transfer was created
        transfer = Transfer.objects.get(id=response_data['id'])
        self.assertEqual(abs(transfer.to_entry.raw_amount), Decimal('300.00'))
        
        # Verify account balances were updated
        self.checking_account.refresh_from_db()
        self.savings_account.refresh_from_db()
        
        self.assertEqual(self.checking_account.cached_actual_balance, Decimal('700.00'))
        self.assertEqual(self.savings_account.cached_actual_balance, Decimal('5300.00'))
    
    def test_validate_transfer_api(self):
        """Test transfer validation endpoint."""
        validation_data = {
            'from_account': str(self.checking_account.id),
            'to_account': str(self.credit_account.id),
            'amount': '500.00'
        }
        
        response = self.client.post(
            '/api/v1/ledger/transfers/validate/',
            data=json.dumps(validation_data),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        response_data = response.json()
        
        # Should be valid
        self.assertTrue(response_data['validation']['is_valid'])
        
        # Check balance calculations
        self.assertEqual(
            response_data['from_account']['current_balance'], 
            '1000.00'
        )
        self.assertEqual(
            response_data['from_account']['balance_after'], 
            '500.00'
        )
    
    def test_validate_insufficient_funds(self):
        """Test validation with insufficient funds."""
        validation_data = {
            'from_account': str(self.checking_account.id),
            'to_account': str(self.savings_account.id),
            'amount': '2000.00'  # More than available
        }
        
        response = self.client.post(
            '/api/v1/ledger/transfers/validate/',
            data=json.dumps(validation_data),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        response_data = response.json()
        
        # Should be invalid due to insufficient funds
        self.assertFalse(response_data['validation']['is_valid'])
        self.assertIn('Insufficient funds', ' '.join(response_data['validation']['errors']))
    
    def test_list_transfers(self):
        """Test listing transfers."""
        # Create a test transfer
        transfer = Transfer.create_transfer(
            from_account=self.checking_account,
            to_account=self.savings_account,
            amount=Decimal('200.00'),
            effective_date=date.today(),
            description='Test List Transfer'
        )
        
        response = self.client.get('/api/v1/ledger/transfers/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        response_data = response.json()
        self.assertEqual(len(response_data['results']), 1)
        
        transfer_data = response_data['results'][0]
        self.assertEqual(transfer_data['id'], str(transfer.id))
        self.assertEqual(transfer_data['transfer_amount'], '200.00')
        self.assertEqual(transfer_data['from_account_name'], 'Test Checking')
        self.assertEqual(transfer_data['to_account_name'], 'Test Savings')
    
    def test_transfer_by_account(self):
        """Test getting transfers by account."""
        # Create transfers
        transfer1 = Transfer.create_transfer(
            from_account=self.checking_account,
            to_account=self.savings_account,
            amount=Decimal('100.00'),
            effective_date=date.today(),
            description='Transfer 1'
        )
        
        transfer2 = Transfer.create_transfer(
            from_account=self.savings_account,
            to_account=self.checking_account,
            amount=Decimal('50.00'),
            effective_date=date.today(),
            description='Transfer 2'
        )
        
        # Get transfers for checking account
        response = self.client.get(
            f'/api/v1/ledger/transfers/by_account/?account_id={self.checking_account.id}'
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        response_data = response.json()
        self.assertEqual(len(response_data['outgoing_transfers']), 1)
        self.assertEqual(len(response_data['incoming_transfers']), 1)
        
        # Verify outgoing transfer
        outgoing = response_data['outgoing_transfers'][0]
        self.assertEqual(outgoing['amount'], '100.00')
        self.assertEqual(outgoing['other_account']['name'], 'Test Savings')
        
        # Verify incoming transfer
        incoming = response_data['incoming_transfers'][0]
        self.assertEqual(incoming['amount'], '50.00')
        self.assertEqual(incoming['other_account']['name'], 'Test Savings')
    
    def test_delete_transfer(self):
        """Test deleting a transfer."""
        # Create transfer
        transfer = Transfer.create_transfer(
            from_account=self.checking_account,
            to_account=self.savings_account,
            amount=Decimal('250.00'),
            effective_date=date.today(),
            description='Transfer to delete'
        )
        
        # Record balances after transfer
        self.checking_account.refresh_from_db()
        self.savings_account.refresh_from_db()
        balance_after_transfer_checking = self.checking_account.cached_actual_balance
        balance_after_transfer_savings = self.savings_account.cached_actual_balance
        
        # Delete transfer
        response = self.client.delete(f'/api/v1/ledger/transfers/{transfer.id}/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify transfer is deleted
        self.assertFalse(Transfer.objects.filter(id=transfer.id).exists())
        
        # Verify balances are restored
        self.checking_account.refresh_from_db()
        self.savings_account.refresh_from_db()
        
        # Should be back to original balances
        self.assertEqual(self.checking_account.cached_actual_balance, Decimal('1000.00'))
        self.assertEqual(self.savings_account.cached_actual_balance, Decimal('5000.00'))
    
    def test_transfer_summary(self):
        """Test transfer summary endpoint."""
        # Create different types of transfers
        Transfer.create_transfer(
            from_account=self.checking_account,
            to_account=self.savings_account,
            amount=Decimal('100.00'),
            effective_date=date.today(),
            description='Regular transfer'
        )
        
        Transfer.create_transfer(
            from_account=self.checking_account,
            to_account=self.credit_account,
            amount=Decimal('200.00'),
            effective_date=date.today(),
            description='Credit payment'
        )
        
        response = self.client.get('/api/v1/ledger/transfers/summary/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        response_data = response.json()
        
        self.assertEqual(response_data['totals']['total_transfers'], 2)
        self.assertEqual(response_data['totals']['regular_transfers'], 1)
        self.assertEqual(response_data['amounts']['total_amount'], '300.00')
