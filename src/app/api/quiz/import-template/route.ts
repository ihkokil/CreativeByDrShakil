import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const csvContent = `Question,Option A,Option B,Option C,Option D,Option E,Correct Option,Explanation
"Which of the following is the most common cause of community-acquired pneumonia in adults?","Streptococcus pneumoniae","Mycoplasma pneumoniae","Legionella pneumophila","Haemophilus influenzae","Klebsiella pneumoniae",A,"Streptococcus pneumoniae remains the most common etiology of community-acquired pneumonia in adults worldwide."
"Features characteristic of Horner syndrome include:","Ptosis","Mydriasis","Anhidrosis","Enophthalmos","Flushing of the face",TFTTF,"Horner syndrome consists of miosis (constricted pupil, not mydriasis), ptosis, anhidrosis, and apparent enophthalmos caused by disruption of the sympathetic pathway."
"A 45-year-old male presents with severe epigastric pain radiating to the back. Serum lipase is 4 times the upper limit of normal. What is the most appropriate initial investigation to determine etiology?","Abdominal ultrasound","Endoscopic retrograde cholangiopancreatography (ERCP)","Non-contrast abdominal CT","Serum amylase level","Magnetic resonance cholangiopancreatography (MRCP)",A,"Abdominal ultrasound is recommended as the initial imaging modality in acute pancreatitis to detect gallstones or biliary duct dilatation."
"Regarding the cranial nerves and their functions:","CN III provides motor innervation to the superior oblique muscle","CN V carries sensation from the anterior two-thirds of the tongue","CN VII supplies the muscles of facial expression","CN IX mediates the gag reflex afferent limb","CN XII innervates the trapezius muscle",FTTTF,"CN IV innervates superior oblique, CN III supplies most other extraocular muscles. CN XI innervates trapezius, CN XII innervates tongue muscles."
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