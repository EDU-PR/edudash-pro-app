import '@shopify/flash-list';

declare module '@shopify/flash-list' {
  // FlashList runtime supports this prop; some type bundles omit it.
  interface FlashListProps<TItem> {
    estimatedItemSize?: number;
  }
}
