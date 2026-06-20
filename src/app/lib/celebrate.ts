// Fire a centered celebration with a confetti/firecracker burst.
// The message should already be translated by the caller, e.g. celebrate(t('recipe_form.created')).
// Listened for by <Celebration /> (mounted once in App).
export function celebrate(message: string): void {
  window.dispatchEvent(new CustomEvent('app-celebrate', { detail: { message } }));
}
