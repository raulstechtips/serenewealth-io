from django.test import TestCase
from django.db import transaction
from decimal import Decimal
from datetime import date
from django.core.exceptions import ValidationError

from ledger.models import (
    Account, AccountType, AccountSubtype, Currency,
    Category, CategoryType,
    LedgerEntry, Statement, StatementLine, Transfer
)
from ledger.services import AccountBalanceService


class AccountBalanceServiceTest(TestCase):
    """Test cases for AccountBalanceService."""
    
    def setUp(self):
        """Set up test data."""
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
            cached_actual_balance=Decimal('0.00')
        )
        
        # Create test category
        self.expense_category = Category.objects.create(
            name="Test Expense",
            type=CategoryType.EXPENSE
        )
    
    def test_individual_balance_update(self):
        """Test individual balance updates."""
        initial_balance = self.checking_account.cached_actual_balance
        delta = Decimal('100.50')
        
        AccountBalanceService.update_balance_individual(self.checking_account, delta)
        
        self.checking_account.refresh_from_db()
        expected_balance = initial_balance + delta
        self.assertEqual(self.checking_account.cached_actual_balance, expected_balance)
    
    def test_batch_balance_update(self):
        """Test batch balance updates using F() expressions."""
        initial_balance = self.checking_account.cached_actual_balance
        delta = Decimal('-250.75')
        
        AccountBalanceService.update_balance_batch(self.checking_account, delta)
        
        self.checking_account.refresh_from_db()
        expected_balance = initial_balance + delta
        self.assertEqual(self.checking_account.cached_actual_balance, expected_balance)
    
    def test_recalculate_balance(self):
        """Test balance recalculation from ledger entries."""
        # Create some ledger entries
        LedgerEntry.objects.create(
            account=self.checking_account,
            effective_date=date.today(),
            raw_amount=Decimal('100.00'),
            signed_amount=Decimal('100.00'),
            description="Test deposit",
            category=self.expense_category,
            skip_balance_update=True  # Skip automatic updates for this test
        )
        
        LedgerEntry.objects.create(
            account=self.checking_account,
            effective_date=date.today(),
            raw_amount=Decimal('-50.00'),
            signed_amount=Decimal('-50.00'),
            description="Test withdrawal",
            category=self.expense_category,
            skip_balance_update=True  # Skip automatic updates for this test
        )
        
        # Manually set incorrect cached balance
        self.checking_account.cached_actual_balance = Decimal('999.99')
        self.checking_account.save()
        
        # Recalculate balance
        calculated_balance = AccountBalanceService.recalculate_balance(self.checking_account)
        
        # Should be initial 1000 + 100 - 50 = 1050
        expected_balance = Decimal('1050.00')
        self.assertEqual(calculated_balance, expected_balance)
        
        self.checking_account.refresh_from_db()
        self.assertEqual(self.checking_account.cached_actual_balance, expected_balance)
    
    def test_ledger_entry_creation_updates_balance(self):
        """Test that creating a ledger entry automatically updates balance."""
        initial_balance = self.checking_account.cached_actual_balance
        
        entry = LedgerEntry.objects.create(
            account=self.checking_account,
            effective_date=date.today(),
            raw_amount=Decimal('200.00'),
            description="Test entry",
            category=self.expense_category
        )
        
        self.checking_account.refresh_from_db()
        expected_balance = initial_balance + entry.signed_amount
        self.assertEqual(self.checking_account.cached_actual_balance, expected_balance)
    
    def test_ledger_entry_update_updates_balance(self):
        """Test that updating a ledger entry updates balance correctly."""
        # Create initial entry
        entry = LedgerEntry.objects.create(
            account=self.checking_account,
            effective_date=date.today(),
            raw_amount=Decimal('100.00'),
            description="Test entry",
            category=self.expense_category
        )
        
        initial_balance = self.checking_account.cached_actual_balance
        
        # Update the entry amount
        entry.raw_amount = Decimal('150.00')
        entry.save()
        
        self.checking_account.refresh_from_db()
        # Balance should increase by the difference (150 - 100 = 50)
        expected_balance = initial_balance + Decimal('50.00')
        self.assertEqual(self.checking_account.cached_actual_balance, expected_balance)
    
    def test_ledger_entry_deletion_updates_balance(self):
        """Test that deleting a ledger entry updates balance correctly."""
        # Create entry
        entry = LedgerEntry.objects.create(
            account=self.checking_account,
            effective_date=date.today(),
            raw_amount=Decimal('75.00'),
            description="Test entry",
            category=self.expense_category
        )
        
        balance_after_creation = self.checking_account.cached_actual_balance
        
        # Delete the entry
        entry.delete()
        
        self.checking_account.refresh_from_db()
        # Balance should decrease by the entry amount
        expected_balance = balance_after_creation - Decimal('75.00')
        self.assertEqual(self.checking_account.cached_actual_balance, expected_balance)
    
    def test_transfer_creation(self):
        """Test transfer creation updates both account balances."""
        initial_checking = self.checking_account.cached_actual_balance
        initial_savings = self.savings_account.cached_actual_balance
        transfer_amount = Decimal('300.00')
        
        transfer = Transfer.create_transfer(
            from_account=self.checking_account,
            to_account=self.savings_account,
            amount=transfer_amount,
            effective_date=date.today(),
            description="Test transfer"
        )
        
        self.checking_account.refresh_from_db()
        self.savings_account.refresh_from_db()
        
        # Checking should decrease (asset account: negative raw amount = negative signed amount)
        expected_checking = initial_checking - transfer_amount
        self.assertEqual(self.checking_account.cached_actual_balance, expected_checking)
        
        # Savings should increase (asset account: positive raw amount = positive signed amount)
        expected_savings = initial_savings + transfer_amount
        self.assertEqual(self.savings_account.cached_actual_balance, expected_savings)
        
        # Verify transfer object
        self.assertEqual(transfer.from_entry.account, self.checking_account)
        self.assertEqual(transfer.to_entry.account, self.savings_account)
        self.assertEqual(transfer.from_entry.raw_amount, -transfer_amount)
        self.assertEqual(transfer.to_entry.raw_amount, transfer_amount)
    
    def test_statement_batch_processing(self):
        """Test batch processing of statement lines."""
        # Create statement
        statement = Statement.objects.create(
            account=self.checking_account,
            period_start=date(2024, 1, 1),
            period_end=date(2024, 1, 31),
            opening_balance=Decimal('1000.00'),
            closing_balance=Decimal('1150.00')
        )
        
        # Create statement lines
        StatementLine.objects.create(
            statement=statement,
            posted_at=date(2024, 1, 15),
            amount=Decimal('100.00'),
            description="Deposit"
        )
        
        StatementLine.objects.create(
            statement=statement,
            posted_at=date(2024, 1, 20),
            amount=Decimal('50.00'),
            description="Another deposit"
        )
        
        initial_balance = self.checking_account.cached_actual_balance
        
        # Process statement in batch
        created_entries = AccountBalanceService.process_statement_batch(
            statement, statement.closing_balance
        )
        
        # Should create 2 entries
        self.assertEqual(len(created_entries), 2)
        
        # Balance should be updated by total amount (100 + 50 = 150)
        self.checking_account.refresh_from_db()
        expected_balance = initial_balance + Decimal('150.00')
        self.assertEqual(self.checking_account.cached_actual_balance, expected_balance)
    
    def test_statement_batch_processing_balance_verification_failure(self):
        """Test that batch processing fails with incorrect closing balance."""
        statement = Statement.objects.create(
            account=self.checking_account,
            period_start=date(2024, 1, 1),
            period_end=date(2024, 1, 31),
            opening_balance=Decimal('1000.00'),
            closing_balance=Decimal('9999.99')  # Incorrect closing balance
        )
        
        StatementLine.objects.create(
            statement=statement,
            posted_at=date(2024, 1, 15),
            amount=Decimal('100.00'),
            description="Deposit"
        )
        
        # Should raise ValidationError due to balance mismatch
        with self.assertRaises(ValidationError):
            AccountBalanceService.process_statement_batch(
                statement, statement.closing_balance
            )
    
    def test_balance_verification(self):
        """Test balance verification functionality."""
        # Create entry manually without balance update
        LedgerEntry.objects.create(
            account=self.checking_account,
            effective_date=date.today(),
            raw_amount=Decimal('100.00'),
            signed_amount=Decimal('100.00'),
            description="Test entry",
            category=self.expense_category,
            skip_balance_update=True
        )
        
        # Balance should not match now
        is_correct = AccountBalanceService.verify_account_balance(self.checking_account)
        self.assertFalse(is_correct)
        
        # Recalculate balance
        AccountBalanceService.recalculate_balance(self.checking_account)
        
        # Now it should match
        is_correct = AccountBalanceService.verify_account_balance(self.checking_account)
        self.assertTrue(is_correct)
    
    def test_get_balance_discrepancies(self):
        """Test finding accounts with balance discrepancies."""
        # Create entry without balance update to create discrepancy
        LedgerEntry.objects.create(
            account=self.checking_account,
            effective_date=date.today(),
            raw_amount=Decimal('100.00'),
            signed_amount=Decimal('100.00'),
            description="Test entry",
            category=self.expense_category,
            skip_balance_update=True
        )
        
        discrepancies = AccountBalanceService.get_balance_discrepancies()
        
        # Should find one discrepancy
        self.assertEqual(len(discrepancies), 1)
        self.assertEqual(discrepancies[0]['account_id'], str(self.checking_account.id))
        self.assertEqual(discrepancies[0]['difference'], Decimal('100.00'))
    
    def test_zero_amount_operations_ignored(self):
        """Test that zero amount operations don't affect balance."""
        initial_balance = self.checking_account.cached_actual_balance
        
        # Zero amount updates should be ignored
        AccountBalanceService.update_balance_individual(self.checking_account, Decimal('0.00'))
        AccountBalanceService.update_balance_batch(self.checking_account, Decimal('0.00'))
        
        self.checking_account.refresh_from_db()
        self.assertEqual(self.checking_account.cached_actual_balance, initial_balance)
