# Bundle compact item disclosure

User requests a smaller Bundle item detail area, showing items only after a
tap and sliding the area below its summary. Current BundleImage renders its
horizontal item carousel immediately under the hero/title/real-price summary.

Keep the hero/name/price/expiry/item count visible. Add an accessible disclosure
button; collapse the item area by default, tap opens a compact carousel below,
tap again closes. Animate the bounded reveal with existing Motion tokens and
live Reduce Motion; retain stable bundle/item keys and avoid remount/opacity
flashes. Collapse on different bundle identity, preserve parent ownership data.

Use flat opaque content surfaces for BundleImage/BundleItem; remove their
existing optical decoration and shadows in this same owned scope. Preserve
actual prices/discounts/owned indicators, screenshots mode, all item types,
horizontal scrolling, image/cache identity, long price fitting and network
refresh. No purchase, wishlist, equip, backend or account behavior is added.

Specialist owns BundleImage.tsx,BundleItem.tsx and their scoped tests; main owns
nav, generated More asset, other halo fixes, phone and final gates. Capture valid
behavior RED before edits, then scoped GREEN/review. Physical tests must cover
initial collapse, open/downward reveal, horizontal swipe, close/reopen, back,
Reduce Motion and native geometry. Keep source proof separate from device proof.
