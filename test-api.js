// Simple test script to verify our F1 GPT API
const testChat = async () => {
  try {
    console.log('🏎️ Testing F1 GPT API...\n');

    const response = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content: 'Who is Lewis Hamilton?'
          }
        ]
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const fs = require('fs');
      fs.writeFileSync('error.json', JSON.stringify(errorData, null, 2));
      console.error('API Error Details:', errorData);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ API Response:');
    console.log(data.message);
    console.log('\n🎉 F1 GPT is working with semantic search!');

  } catch (error) {
    const fs = require('fs');
    fs.writeFileSync('error-network.txt', error.toString());
    console.error('❌ Error testing API:', error.message);
    console.log('\n💡 Make sure to:');
    console.log('1. Start the Next.js server: npm run dev');
    console.log('2. Ensure your .env file has all required keys');
    console.log('3. Check that the database seeding completed successfully');
  }
};

testChat();