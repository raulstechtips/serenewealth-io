import uuid
from django.db import models
from django.contrib.auth.models import User

class CategoryType(models.TextChoices):
    INCOME = "INCOME", "Income"
    EXPENSE = "EXPENSE", "Expense"
    TRANSFER = "TRANSFER", "Transfer"

class CategoryGroup(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="category_groups")
    name = models.CharField(max_length=255)  # "Auto & Transport", "Housing", etc.
    type = models.CharField(max_length=255, choices=CategoryType.choices)
    
    class Meta:
        unique_together = [["user", "name", "type"]]
    
    def __str__(self):
        return f"{self.name} ({self.type})"

class Category(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="categories")
    group = models.ForeignKey(CategoryGroup, on_delete=models.CASCADE, related_name="categories")
    name = models.CharField(max_length=255)  # "Auto Payment", "Gas", "Mortgage", etc.
    
    class Meta:
        unique_together = [["user", "group", "name"]]

    @property
    def type(self):
        """Get the category type from the parent group."""
        return self.group.type

    def __str__(self):
        return f"{self.type} ({self.group.name} > {self.name})"
