/** Reject descriptions synthesized from filenames by the old finalizer. */
export function isInferredAnalysis(value: {description?: string; analysisSource?: string} | undefined): boolean {
 return value?.analysisSource === 'filename-inference' || /interior showing contemporary design, styling and finishes\./i.test(value?.description ?? '');
}
