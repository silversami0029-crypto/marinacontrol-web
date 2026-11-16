# Enable checklist creation in Firestore

The web app creates the checklist and its items together in one batch. The current checklist-item rule checks the parent before the batch, so the parent is absent during creation.

In **Firestore Database → Rules**, replace the existing `match /checklists/{checklistId}/items/{itemId}` block with this block. This keeps the same tenant permission helpers and uses the pending parent for item creation.

```firebase
match /checklists/{checklistId}/items/{itemId} {
  function parentChecklist() {
    return /databases/$(database)/documents/checklists/$(checklistId);
  }

  allow read: if canReadTenant(get(parentChecklist()).data.clientId);
  allow create: if canWriteTenant(getAfter(parentChecklist()).data.clientId);
  allow update, delete: if canWriteTenant(get(parentChecklist()).data.clientId);
}
```

Publish the rule, then test **Checklists → + → Use App Template** as a marina user and as a yacht user.

## Custom import

CSV example:

```csv
text,category,mandatory
Check bilge pump,Engine,true
"Check lines, fenders and deck gear",Deck,false
```

JSON example:

```json
{
  "name": "Departure checks",
  "items": [
    { "text": "Check bilge pump", "category": "Engine", "mandatory": true }
  ]
}
```

The web app also accepts a bare JSON items array. An import can contain up to 100 items.
