export interface AnalyzedProductJSON {
    product_name?: string;
    description?: string;
    features?: string[];
    analyzed_at: string;
    // Add other fields as necessary from the prompt output
}
