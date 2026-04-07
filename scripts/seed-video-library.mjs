import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Helper: create a folder node, then recursively create its children.
 * Returns the created folder's id.
 */
async function createFolder(title, parentId, sortOrder, children = []) {
    const folder = await prisma.videoLibraryNode.create({
        data: {
            title,
            type: 'folder',
            parentId,
            sortOrder,
        },
    });

    for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (child.children) {
            await createFolder(child.title, folder.id, i, child.children);
        } else {
            await prisma.videoLibraryNode.create({
                data: {
                    title: child.title,
                    type: child.type || 'youtube',
                    url: child.url || null,
                    duration: child.duration || null,
                    parentId: folder.id,
                    sortOrder: i,
                },
            });
        }
    }

    return folder.id;
}

async function main() {
    console.log('🗑️  Clearing existing video library nodes...');
    await prisma.videoLibraryNode.deleteMany({});

    console.log('📚 Seeding Video Library...\n');

    const library = [
        {
            title: 'Anatomy',
            children: [
                {
                    title: 'Embryology',
                    children: [
                        { title: 'General Embryology', type: 'youtube', url: 'https://www.youtube.com/watch?v=OCPj85-4A5w' },
                        { title: 'First, Second, Third Week of Development', type: 'youtube', url: 'https://www.youtube.com/watch?v=uILf0Waoob0' },
                        { title: 'Placenta', type: 'youtube', url: 'https://www.youtube.com/watch?v=WseRyKV6Ku8' },
                        { title: 'General Embryology Questions & Discussions', type: 'youtube', url: 'https://www.youtube.com/watch?v=w4_MQoYaTxw' },
                        { title: 'Systemic Embryology', type: 'youtube', url: 'https://www.youtube.com/watch?v=FUs1aC4XWYQ' },
                    ],
                },
                {
                    title: 'Abdomen',
                    children: [
                        { title: 'Abdomen Class 1', type: 'youtube', url: 'https://www.youtube.com/watch?v=u3KwVIAqg4Q' },
                        { title: 'Abdomen Class 2', type: 'youtube', url: 'https://www.youtube.com/watch?v=AxVu73DNYw0' },
                        { title: 'Abdomen Class 3', type: 'youtube', url: 'https://www.youtube.com/watch?v=zKRByv7y2Bc' },
                        { title: 'Abdomen Class 4', type: 'youtube', url: 'https://www.youtube.com/watch?v=rtvo8qRFKy8' },
                        { title: 'Abdomen Class 5 - Pelvic Anatomy', type: 'youtube', url: 'https://www.youtube.com/watch?v=lFeDCyYpKOU' },
                        { title: 'Abdomen Questions & Discussions', type: 'youtube', url: 'https://www.youtube.com/watch?v=dmkyBVB_7rw' },
                    ],
                },
                {
                    title: 'Thorax',
                    children: [
                        { title: 'Thorax Class 1', type: 'youtube', url: 'https://www.youtube.com/watch?v=9nWwl3Jupmg' },
                        { title: 'Thorax Class 2', type: 'youtube', url: 'https://www.youtube.com/watch?v=KQRwxo-Dk7o' },
                    ],
                },
                {
                    title: 'Superior Extremity',
                    children: [
                        { title: 'Superior Extremity Questions & Discussions', type: 'youtube', url: 'https://www.youtube.com/watch?v=p1JXDM5J2pk' },
                    ],
                },
                {
                    title: 'Inferior Extremity',
                    children: [
                        { title: 'Inferior Extremity Class 1', type: 'youtube', url: 'https://www.youtube.com/watch?v=L7SJwF_liuQ' },
                        { title: 'Inferior Extremity Class 2', type: 'youtube', url: 'https://www.youtube.com/watch?v=BSi3y0o5oqo' },
                    ],
                },
                {
                    title: 'Histology',
                    children: [
                        { title: 'Histology Class 1', type: 'youtube', url: 'https://www.youtube.com/watch?v=YcsyVhDdFzA' },
                        { title: 'Histology Class 2', type: 'youtube', url: 'https://www.youtube.com/watch?v=anwzXPuagdQ' },
                    ],
                },
            ],
        },
        {
            title: 'Physiology',
            children: [
                {
                    title: 'Respiratory Physiology',
                    children: [
                        { title: 'Respiratory Physiology', type: 'youtube', url: 'https://www.youtube.com/watch?v=yMzhy2QdV-E' },
                        { title: 'Respiratory Questions & Discussions', type: 'youtube', url: 'https://www.youtube.com/watch?v=jm2jOazEoAs' },
                    ],
                },
                {
                    title: 'Cardiovascular System (CVS)',
                    children: [
                        { title: 'CVS Physiology Class 1', type: 'youtube', url: 'https://www.youtube.com/watch?v=4jzWo6xKHJw' },
                        { title: 'CVS Physiology Class 2', type: 'youtube', url: 'https://www.youtube.com/watch?v=7MhrkQqAijc' },
                        { title: 'Cardiac Cycle Class 1', type: 'youtube', url: 'https://www.youtube.com/watch?v=Z4UCcDVW3Nw' },
                        { title: 'Cardiac Cycle Class 2', type: 'youtube', url: 'https://www.youtube.com/watch?v=g-tg6d8fblI' },
                        { title: 'Different Waves of JVP', type: 'youtube', url: 'https://www.youtube.com/watch?v=VeXJUkjx8AM' },
                    ],
                },
                {
                    title: 'Renal Physiology',
                    children: [
                        { title: 'Renal Physiology Class 1', type: 'youtube', url: 'https://www.youtube.com/watch?v=nBw7Y9IktXs' },
                        { title: 'Renal Physiology Class 2', type: 'youtube', url: 'https://www.youtube.com/watch?v=yQAEhP9Jt2I' },
                    ],
                },
                {
                    title: 'Fluid, Electrolyte & Acid-Base Balance',
                    children: [
                        { title: 'Body Fluid & Sodium', type: 'youtube', url: 'https://www.youtube.com/watch?v=3602Rc-D6hY' },
                        { title: 'K+ Potassium Electrolyte', type: 'youtube', url: 'https://www.youtube.com/watch?v=k1ZKUbZPKHs' },
                        { title: 'Calcium Metabolism', type: 'youtube', url: 'https://www.youtube.com/watch?v=z4m2yHYAxv8' },
                        { title: 'Acid Base Basic', type: 'youtube', url: 'https://www.youtube.com/watch?v=h2abEECG44M' },
                        { title: 'Anion Gap, RTA', type: 'youtube', url: 'https://www.youtube.com/watch?v=KSoUFicnCf0' },
                    ],
                },
                {
                    title: 'Gastrointestinal (GIT) Physiology',
                    children: [
                        { title: 'Gastrointestinal GIT Physiology', type: 'youtube', url: 'https://www.youtube.com/watch?v=HRM8-WlwgVw' },
                        { title: 'Salivary Secretion (High Flow, Low Flow)', type: 'youtube', url: 'https://www.youtube.com/watch?v=3eSEiDzaFQg' },
                    ],
                },
                {
                    title: 'Endocrinology',
                    children: [
                        { title: 'Endocrine Introduction', type: 'youtube', url: 'https://www.youtube.com/watch?v=Xwxm40mhfK0' },
                        { title: 'Pituitary Gland', type: 'youtube', url: 'https://www.youtube.com/watch?v=mUCjdO8XQdk' },
                        { title: 'Thyroid Gland', type: 'youtube', url: 'https://www.youtube.com/watch?v=Z3WTipfeORM' },
                        { title: 'Adrenal Gland', type: 'youtube', url: 'https://www.youtube.com/watch?v=9EFHVaAW7fU' },
                        { title: 'Insulin / Diabetes Mellitus', type: 'youtube', url: 'https://www.youtube.com/watch?v=b2U31liQmMA' },
                        { title: 'Reproductive Endocrinology', type: 'youtube', url: 'https://www.youtube.com/watch?v=7xzZI8ZDgzo' },
                    ],
                },
                {
                    title: 'Hematology (Blood Physiology)',
                    children: [
                        { title: 'Red Blood Cell (RBC / Erythrocyte)', type: 'youtube', url: 'https://www.youtube.com/watch?v=wooCu8Ml598' },
                        { title: 'White Blood Cells (WBC / Leukocytes)', type: 'youtube', url: 'https://www.youtube.com/watch?v=T-SToOaJ0xE' },
                        { title: 'Platelet (Thrombocytes) Class 1', type: 'youtube', url: 'https://www.youtube.com/watch?v=MFC53JQYd20' },
                        { title: 'Platelet (Thrombocytes) Class 2', type: 'youtube', url: 'https://www.youtube.com/watch?v=9TfVlngm4_s' },
                        { title: 'Blood Transfusion', type: 'youtube', url: 'https://www.youtube.com/watch?v=JR0cZz1isx8' },
                    ],
                },
            ],
        },
        {
            title: 'Pathology',
            children: [
                {
                    title: 'Cell Injury & Adaptation',
                    children: [
                        { title: 'Cell Injury', type: 'youtube', url: 'https://www.youtube.com/watch?v=hhRRQ77e39A' },
                    ],
                },
                {
                    title: 'Inflammation & Repair',
                    children: [
                        { title: 'Inflammation', type: 'youtube', url: 'https://www.youtube.com/watch?v=uEjJc9mt688' },
                        { title: 'Healing / Repair', type: 'youtube', url: 'https://www.youtube.com/watch?v=lDsqM3iar2E' },
                    ],
                },
                {
                    title: 'Hemodynamics (Circulatory Disturbances)',
                    children: [
                        { title: 'Hemodynamics', type: 'youtube', url: 'https://www.youtube.com/watch?v=krrA7DFi1u8' },
                    ],
                },
                {
                    title: 'Neoplasia (Tumors)',
                    children: [
                        { title: 'Neoplasm Class 1', type: 'youtube', url: 'https://www.youtube.com/watch?v=0ZZmR6Dlgo4' },
                        { title: 'Neoplasm Class 2', type: 'youtube', url: 'https://www.youtube.com/watch?v=3441B0bGtmg' },
                    ],
                },
                {
                    title: 'Genetics',
                    children: [
                        { title: 'Genetics Class 1', type: 'youtube', url: 'https://www.youtube.com/watch?v=q914xARLI7U' },
                        { title: 'Genetics Class 2', type: 'youtube', url: 'https://www.youtube.com/watch?v=ShSZp3fe5q0' },
                    ],
                },
            ],
        },
        {
            title: 'Neurosurgery',
            children: [
                {
                    title: 'Basic Neuro (Foundation)',
                    children: [
                        { title: 'Neuron, Supporting Cell, BBB', type: 'youtube', url: 'https://www.youtube.com/watch?v=RRLyTEnayQE' },
                        { title: 'Nerve Fibre, Neurotransmitter, Receptor, CSF, Golgi Spindle', type: 'youtube', url: 'https://www.youtube.com/watch?v=rY_A25EbFPE' },
                    ],
                },
                {
                    title: 'Cerebrum & Higher Centers',
                    children: [
                        { title: 'Cerebral Cortex', type: 'youtube', url: 'https://www.youtube.com/watch?v=e5PQSRxcae4' },
                        { title: 'Basal Ganglia, Internal Capsule, Venous Sinus', type: 'youtube', url: 'https://www.youtube.com/watch?v=aHPtcziuws4' },
                        { title: 'Thalamus, Hypothalamus, Cerebellum, Cranial Nerve', type: 'youtube', url: 'https://www.youtube.com/watch?v=K4DCGQbZ4VM' },
                    ],
                },
                {
                    title: 'Brainstem',
                    children: [
                        { title: "Brain Stem, Brain Stem Syndrome, Horner's Syndrome", type: 'youtube', url: 'https://www.youtube.com/watch?v=DjOjCRThoTI' },
                        { title: 'Bulbar & Pseudobulbar Palsy', type: 'youtube', url: 'https://www.youtube.com/watch?v=UglqxsfNqFs' },
                    ],
                },
                {
                    title: 'Spinal Cord',
                    children: [
                        { title: 'Spinal Cord - Anatomy', type: 'youtube', url: 'https://www.youtube.com/watch?v=Gdsa28Ee5BQ' },
                        { title: 'Tract (Ascending / Descending)', type: 'youtube', url: 'https://www.youtube.com/watch?v=TYaJAq6dyfk' },
                        { title: 'Spinal Cord - Hemisection', type: 'youtube', url: 'https://www.youtube.com/watch?v=dYt4Od7XLcU' },
                        { title: 'Spinal Cord - Transection', type: 'youtube', url: 'https://www.youtube.com/watch?v=2q0PdJR1cBQ' },
                    ],
                },
                {
                    title: 'Blood Supply (Neurovascular)',
                    children: [
                        { title: 'Blood Supply of Head, Neck, Brain', type: 'youtube', url: 'https://www.youtube.com/watch?v=aebOKuZqr38' },
                    ],
                },
                {
                    title: 'Meninges & CSF System',
                    children: [
                        { title: 'Meninges', type: 'youtube', url: 'https://www.youtube.com/watch?v=Y9NZ60zx_BQ' },
                    ],
                },
                {
                    title: 'Peripheral & Applied Neuro',
                    children: [
                        { title: 'UB Nerve Supply & Neurogenic Bladder', type: 'youtube', url: 'https://www.youtube.com/watch?v=XRhz6cS4-0o' },
                    ],
                },
                {
                    title: 'Head & Neck / Special Senses',
                    children: [
                        { title: 'Special Sense, Larynx, Pharynx, Tongue, Neck', type: 'youtube', url: 'https://www.youtube.com/watch?v=CSs0q5Nv_fU' },
                    ],
                },
            ],
        },
        {
            title: 'Pharmacology',
            children: [
                {
                    title: 'General Pharmacology',
                    children: [
                        { title: 'General Pharmacology (Part 1)', type: 'youtube', url: 'https://www.youtube.com/watch?v=JlHaQ10e2VA' },
                        { title: 'General Pharmacology (Part 2)', type: 'youtube', url: 'https://www.youtube.com/watch?v=qHBclm25tus' },
                    ],
                },
                {
                    title: 'Autonomic Nervous System (ANS) Pharmacology',
                    children: [
                        { title: 'Autonomic Pharmacology', type: 'youtube', url: 'https://www.youtube.com/watch?v=usOowSnXJiw' },
                    ],
                },
                {
                    title: 'Cardiovascular Pharmacology',
                    children: [
                        { title: 'Cardiac Pharmacology', type: 'youtube', url: 'https://www.youtube.com/watch?v=wfmeVW1hQuk' },
                    ],
                },
                {
                    title: 'Systemic Pharmacology',
                    children: [
                        { title: 'Respiratory, Renal, Gastro, Endocrine Pharmacology', type: 'youtube', url: 'https://www.youtube.com/watch?v=gWOCI7KcZzM' },
                    ],
                },
                {
                    title: 'CNS & Inflammatory Pharmacology',
                    children: [
                        { title: 'NSAIDs, CNS Drugs (Antidepressants, Antipsychotics, Sedatives)', type: 'youtube', url: 'https://www.youtube.com/watch?v=-EXf6V-Zrlk' },
                    ],
                },
            ],
        },
        {
            title: 'Microbiology',
            children: [
                {
                    title: 'General Microbiology (Basics)',
                    children: [
                        { title: 'General Bacteriology', type: 'youtube', url: 'https://www.youtube.com/watch?v=T3v5I6IZz0o' },
                    ],
                },
                {
                    title: 'Bacteriology (Systemic)',
                    children: [
                        { title: 'Systemic Bacteriology 1', type: 'youtube', url: 'https://www.youtube.com/watch?v=1RkT-p7Vwkw' },
                        { title: 'Systemic Bacteriology 2', type: 'youtube', url: 'https://www.youtube.com/watch?v=nh98NNjj-kk' },
                        { title: 'Systemic Bacteriology 3', type: 'youtube', url: 'https://www.youtube.com/watch?v=4GK7FkN_wmg' },
                    ],
                },
                {
                    title: 'Virology',
                    children: [
                        { title: 'Virology Class 1', type: 'youtube', url: 'https://www.youtube.com/watch?v=EXBbV2lgY9E' },
                        { title: 'Virology Class 2', type: 'youtube', url: 'https://www.youtube.com/watch?v=8wujb_YinOs' },
                        { title: 'Virology Class 3', type: 'youtube', url: 'https://www.youtube.com/watch?v=6Y5o9nB72z4' },
                        { title: 'Virology Class 4 – HIV (AIDS)', type: 'youtube', url: 'https://www.youtube.com/watch?v=z4V_Dod97Kc' },
                    ],
                },
                {
                    title: 'Parasitology',
                    children: [
                        { title: 'Parasitology', type: 'youtube', url: 'https://www.youtube.com/watch?v=em5cxn1Y38I' },
                    ],
                },
                {
                    title: 'Mycology (Fungi)',
                    children: [
                        { title: 'Mycology', type: 'youtube', url: 'https://www.youtube.com/watch?v=AdDOay3OI84' },
                    ],
                },
                {
                    title: 'Infectious Disease Groups (Clinical Micro)',
                    children: [
                        { title: 'Infectious Zoonotic Disease', type: 'youtube', url: 'https://www.youtube.com/watch?v=PPCPGmFcxrQ' },
                        { title: 'Sexually Transmitted Diseases (STD)', type: 'youtube', url: 'https://www.youtube.com/watch?v=tAFMPLWyySk' },
                    ],
                },
                {
                    title: 'Immunology',
                    children: [
                        { title: 'Immunology Class 1', type: 'youtube', url: 'https://www.youtube.com/watch?v=crdcu4E5fuU' },
                        { title: 'Immunology Class 2', type: 'youtube', url: 'https://www.youtube.com/watch?v=QxA9HA_S1F0' },
                    ],
                },
            ],
        },
        {
            title: 'Biostatistics',
            children: [
                { title: 'Biostatistics Class 1', type: 'youtube', url: 'https://www.youtube.com/watch?v=fo02OaC4pJ4' },
                { title: 'Biostatistics Class 2', type: 'youtube', url: 'https://www.youtube.com/watch?v=XozXRyj1czc' },
            ],
        },
    ];

    for (let i = 0; i < library.length; i++) {
        const root = library[i];
        await createFolder(root.title, null, i, root.children);
        console.log(`  ✅ ${root.title}`);
    }

    const count = await prisma.videoLibraryNode.count();
    console.log(`\n🎉 Done! ${count} nodes inserted into VideoLibraryNode table.`);
}

main()
    .catch((e) => {
        console.error('❌ Seed failed:', e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
