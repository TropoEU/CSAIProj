/**
 * Quick test script to verify adaptive mode parameter validation
 */

import toolManager from './src/services/toolManager.js';

async function testParameterValidation() {
    console.log('Testing parameter validation...\n');

    // Load Bob's Pizza Shop tools
    const clientId = 19;
    const tools = await toolManager.getClientTools(clientId);

    console.log('Loaded tools:', tools.length);
    const bookTool = tools.find(t => t.tool_name === 'book_appointment');

    if (!bookTool) {
        console.log('ERROR: book_appointment tool not found!');
        return;
    }

    console.log('\nbook_appointment tool:');
    console.log('- tool_name:', bookTool.tool_name);
    console.log('- has parameters_schema:', !!bookTool.parameters_schema);
    console.log('- parameters_schema type:', typeof bookTool.parameters_schema);
    console.log('- parameters_schema:', JSON.stringify(bookTool.parameters_schema, null, 2));

    const schema = bookTool.parameters_schema || {};
    const required = schema.required || [];
    console.log('\nRequired parameters:', required);

    // Simulate the assessment from the AI
    const assessment = {
        tool_call: 'book_appointment',
        tool_params: {
            party_size: 4,
            name: 'John Smith',
            time: '7pm',
            date: '2026-01-05'
        }
    };

    console.log('\nAssessment tool_params:', Object.keys(assessment.tool_params));

    // Run the validation logic
    const provided = Object.keys(assessment.tool_params || {});
    const actuallyMissing = required.filter(param => !provided.includes(param));

    console.log('\nValidation results:');
    console.log('- Provided params:', provided);
    console.log('- Required params:', required);
    console.log('- Missing params:', actuallyMissing);
    console.log('- Should block:', actuallyMissing.length > 0);

    process.exit(0);
}

testParameterValidation().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
