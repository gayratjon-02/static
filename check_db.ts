
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { join } from 'path';

dotenv.config({ path: join(process.cwd(), '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const client = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log('Checking database state...');

    // 1. Check concept_categories table
    const { error: catError } = await client.from('concept_categories').select('*').limit(1);
    console.log('concept_categories table exists:', !catError);
    if (catError) console.error('Error:', catError.message);

    // 2. Add specific checks for the user from logs if possible, or just first user
    // The log showed user: dd0696be-5ff8-4d88-bcb4-0cce86fd98ae
    // But we don't have their auth token easily. We can just check data existence.

    // 3. Check generated_ads columns
    // We can't check columns directly via JS client easily without a query that uses them
    // Try to insert a dummy row (and fail) to see if columns exist? 
    // Or just rely on the migration check we did earlier.

    console.log('\n--- Checking Data Integrity ---');

    // Get a brand
    const { data: brands } = await client.from('brands').select('_id, user_id').limit(1);
    if (!brands?.length) {
        console.log('No brands found');
        return;
    }
    const brand = brands[0];
    console.log('Brand found:', brand._id);

    // Get a product for this brand
    const { data: products } = await client.from('products').select('_id, brand_id').eq('brand_id', brand._id).limit(1);
    if (!products?.length) {
        console.log('No products found for this brand');
        return;
    }
    const product = products[0];
    console.log('Product found:', product._id);

    // Get a concept
    const { data: concepts } = await client.from('ad_concepts').select('_id, is_active').eq('is_active', true).limit(1);
    if (!concepts?.length) {
        console.log('No active concepts found');
        return;
    }
    const concept = concepts[0];
    console.log('Concept found:', concept._id);

    console.log(`\nReady to test generation with:\nBrand: ${brand._id}\nProduct: ${product._id}\nConcept: ${concept._id}`);
}

main().catch(console.error);
