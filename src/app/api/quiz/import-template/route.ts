import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const csvContent = `Question,Option A,Option B,Option C,Option D,Option E,Correct Option,Explanation
"What is the capital of France?",Paris,London,Berlin,Madrid,Rome,A,"Paris is the capital and most populous city of France."
"The Earth is flat.",True,False,,,,B,"The Earth is an oblate spheroid (roughly spherical) due to gravity."
"Which planets are in our solar system?",Mars,Venus,Alpha Centauri,Sirius,Moon,TTFFF,"Mars and Venus are planets in our solar system, while Alpha Centauri is a star."
"Water boils at 100°C (212°F) under standard conditions.",True,False,,,,A,"At standard atmospheric pressure, water's boiling point is 100°C."
"How many continents are there on Earth?",7,5,6,8,9,A,"The seven continents are Africa, Antarctica, Asia, Europe, North America, Oceania, and South America."
`;

    return new NextResponse(csvContent, {
      status: 200,
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