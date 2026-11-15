# Firebase setup for yacht photos

The web patch stores the image in the existing Firebase Storage bucket. It saves the object path in `boats.yachtPhotoStoragePath` and leaves Android’s `photoPath` field intact.

Merge this block inside the existing `match /b/{bucket}/o` in Cloud Storage Rules. Keep the existing rule matches. Review overlapping matches because Firebase grants access when any matching rule allows it.

```firebase
match /tenants/{clientId}/yacht-photos/{boatId}/{photoId} {
  function assignedToBoat() {
    let membershipId = request.auth.uid + "_" + clientId;
    let member = firestore.get(
      /databases/(default)/documents/user_marina_memberships/$(membershipId)
    ).data;
    return member.firebaseUid == request.auth.uid
      && member.clientId == int(clientId)
      && member.boatId == int(boatId)
      && member.isActive == 1;
  }

  allow get, delete: if request.auth != null && assignedToBoat();
  allow create: if request.auth != null && assignedToBoat()
    && request.resource.size > 0
    && request.resource.size < 10 * 1024 * 1024
    && request.resource.contentType.matches('image/(jpeg|png|webp)');
}
```

If Firebase prompts for permission to use Firestore from Storage Rules, follow the Firebase Console prompt. If the existing Firestore boat-update rule uses an allowed-field list, include `yachtPhotoStoragePath` for authorised edits to the assigned boat.

The yacht banner and full-photo viewer use the signed-in browser’s Storage request. Ensure the bucket’s CORS configuration permits GET from the exact web app origins you use, such as `https://marinacontrol.co.uk` and `http://localhost:3000`. Merge these origins into the existing configuration to preserve other features.

Verify in a test workspace that an assigned user can upload and view a photo, an unassigned user cannot read the object, and a rejected upload leaves the previous photo visible.
