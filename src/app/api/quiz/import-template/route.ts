import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const csvContent = `Question,Explanation,Correct Option,Option A,Option B,Option C
                        "What is the capital of France?","Paris is the capital and most populous city of France.",Paris,London,Berlin,Madrid
                        "The Earth is flat.","The Earth is an oblate spheroid (roughly spherical) due to gravity.",False,True,,
                        "Which planet is known as the Red Planet?","Mars is often called the Red Planet because of iron oxide (rust) on its surface.",Mars,Venus,Jupiter,Saturn
                        "Water boils at 100°C (212°F) under standard conditions.","At standard atmospheric pressure, water's boiling point is 100°C.",True,False,,
                        "How many continents are there on Earth?","The seven continents are Africa, Antarctica, Asia, Europe, North America, Oceania, and South America.",7,5,6,8
                        `;

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="quiz-import-template.csv"',
      },
    });
  } catch (error: any) {
    console.error('GET /api/quiz/import-template error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}