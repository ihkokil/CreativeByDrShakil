import {
  BuilderCurriculumNode,
  createNodeId,
  slugify,
} from '@/lib/teacher-course-builder';

interface StarterVideo {
  title: string;
  url: string;
}

interface StarterSubTopic {
  id: string;
  title: string;
  videos: StarterVideo[];
  forceFolder?: boolean;
}

export interface StarterMainTopic {
  id: string;
  title: string;
  subTopics: StarterSubTopic[];
}

export const STARTER_CATALOG: StarterMainTopic[] = [
  {
    id: 'anatomy',
    title: 'Anatomy',
    subTopics: [
      {
        id: 'embryology',
        title: 'Embryology',
        videos: [
          { title: 'General Embryology', url: 'https://www.youtube.com/watch?v=OCPj85-4A5w' },
          { title: 'First, Second, Third Week of Development', url: 'https://www.youtube.com/watch?v=uILf0Waoob0' },
          { title: 'Placenta', url: 'https://www.youtube.com/watch?v=WseRyKV6Ku8' },
          { title: 'General Embryology Questions & Discussions', url: 'https://www.youtube.com/watch?v=w4_MQoYaTxw' },
          { title: 'Systemic Embryology', url: 'https://www.youtube.com/watch?v=FUs1aC4XWYQ' },
        ],
      },
      {
        id: 'abdomen',
        title: 'Abdomen',
        videos: [
          { title: 'Abdomen Class 1', url: 'https://www.youtube.com/watch?v=u3KwVIAqg4Q' },
          { title: 'Abdomen Class 2', url: 'https://www.youtube.com/watch?v=AxVu73DNYw0' },
          { title: 'Abdomen Class 3', url: 'https://www.youtube.com/watch?v=zKRByv7y2Bc' },
          { title: 'Abdomen Class 4', url: 'https://www.youtube.com/watch?v=rtvo8qRFKy8' },
          { title: 'Abdomen Class 5 - Pelvic Anatomy', url: 'https://www.youtube.com/watch?v=lFeDCyYpKOU' },
          { title: 'Abdomen Questions & Discussions', url: 'https://www.youtube.com/watch?v=dmkyBVB_7rw' },
        ],
      },
      {
        id: 'thorax',
        title: 'Thorax',
        videos: [
          { title: 'Thorax Class 1', url: 'https://www.youtube.com/watch?v=9nWwl3Jupmg' },
          { title: 'Thorax Class 2', url: 'https://www.youtube.com/watch?v=KQRwxo-Dk7o' },
        ],
      },
      {
        id: 'superior-extremity',
        title: 'Superior Extremity',
        videos: [
          { title: 'Superior Extremity Questions & Discussions', url: 'https://www.youtube.com/watch?v=p1JXDM5J2pk' },
        ],
      },
      {
        id: 'inferior-extremity',
        title: 'Inferior Extremity',
        videos: [
          { title: 'Inferior Extremity Class 1', url: 'https://www.youtube.com/watch?v=L7SJwF_liuQ' },
          { title: 'Inferior Extremity Class 2', url: 'https://www.youtube.com/watch?v=BSi3y0o5oqo' },
        ],
      },
      {
        id: 'histology',
        title: 'Histology',
        videos: [
          { title: 'Histology Class 1', url: 'https://www.youtube.com/watch?v=YcsyVhDdFzA' },
          { title: 'Histology Class 2', url: 'https://www.youtube.com/watch?v=anwzXPuagdQ' },
        ],
      },
    ],
  },
  {
    id: 'physiology',
    title: 'Physiology',
    subTopics: [
      {
        id: 'respiratory-physiology',
        title: 'Respiratory Physiology',
        videos: [
          { title: 'Respiratory Physiology', url: 'https://www.youtube.com/watch?v=yMzhy2QdV-E' },
          { title: 'Respiratory Questions & Discussions', url: 'https://www.youtube.com/watch?v=jm2jOazEoAs' },
        ],
      },
      {
        id: 'cvs',
        title: 'Cardiovascular System (CVS)',
        videos: [
          { title: 'CVS Physiology Class 1', url: 'https://www.youtube.com/watch?v=4jzWo6xKHJw' },
          { title: 'CVS Physiology Class 2', url: 'https://www.youtube.com/watch?v=7MhrkQqAijc' },
          { title: 'Cardiac Cycle Class 1', url: 'https://www.youtube.com/watch?v=Z4UCcDVW3Nw' },
          { title: 'Cardiac Cycle Class 2', url: 'https://www.youtube.com/watch?v=g-tg6d8fblI' },
          { title: 'Different Waves of JVP', url: 'https://www.youtube.com/watch?v=VeXJUkjx8AM' },
        ],
      },
      {
        id: 'renal-physiology',
        title: 'Renal Physiology',
        videos: [
          { title: 'Renal Physiology Class 1', url: 'https://www.youtube.com/watch?v=nBw7Y9IktXs' },
          { title: 'Renal Physiology Class 2', url: 'https://www.youtube.com/watch?v=yQAEhP9Jt2I' },
        ],
      },
      {
        id: 'fluid-electrolyte-acid-base',
        title: 'Fluid, Electrolyte & Acid-Base Balance',
        videos: [
          { title: 'Body Fluid & Sodium', url: 'https://www.youtube.com/watch?v=3602Rc-D6hY' },
          { title: 'K+ Potassium Electrolyte', url: 'https://www.youtube.com/watch?v=k1ZKUbZPKHs' },
          { title: 'Calcium Metabolism', url: 'https://www.youtube.com/watch?v=z4m2yHYAxv8' },
          { title: 'Acid Base Basic', url: 'https://www.youtube.com/watch?v=h2abEECG44M' },
          { title: 'Anion Gap, RTA', url: 'https://www.youtube.com/watch?v=KSoUFicnCf0' },
        ],
      },
      {
        id: 'git-physiology',
        title: 'Gastrointestinal (GIT) Physiology',
        videos: [
          { title: 'Gastrointestinal GIT Physiology', url: 'https://www.youtube.com/watch?v=HRM8-WlwgVw' },
          { title: 'Salivary Secretion (High Flow, Low Flow)', url: 'https://www.youtube.com/watch?v=3eSEiDzaFQg' },
        ],
      },
      {
        id: 'endocrinology',
        title: 'Endocrinology',
        videos: [
          { title: 'Endocrine Introduction', url: 'https://www.youtube.com/watch?v=Xwxm40mhfK0' },
          { title: 'Pituitary Gland', url: 'https://www.youtube.com/watch?v=mUCjdO8XQdk' },
          { title: 'Thyroid Gland', url: 'https://www.youtube.com/watch?v=Z3WTipfeORM' },
          { title: 'Adrenal Gland', url: 'https://www.youtube.com/watch?v=9EFHVaAW7fU' },
          { title: 'Insulin / Diabetes Mellitus', url: 'https://www.youtube.com/watch?v=b2U31liQmMA' },
          { title: 'Reproductive Endocrinology', url: 'https://www.youtube.com/watch?v=7xzZI8ZDgzo' },
        ],
      },
      {
        id: 'hematology',
        title: 'Hematology (Blood Physiology)',
        videos: [
          { title: 'Red Blood Cell (RBC / Erythrocyte)', url: 'https://www.youtube.com/watch?v=wooCu8Ml598' },
          { title: 'White Blood Cells (WBC / Leukocytes)', url: 'https://www.youtube.com/watch?v=T-SToOaJ0xE' },
          { title: 'Platelet (Thrombocytes) Class 1', url: 'https://www.youtube.com/watch?v=MFC53JQYd20' },
          { title: 'Platelet (Thrombocytes) Class 2', url: 'https://www.youtube.com/watch?v=9TfVlngm4_s' },
          { title: 'Blood Transfusion', url: 'https://www.youtube.com/watch?v=JR0cZz1isx8' },
        ],
      },
    ],
  },
  {
    id: 'pathology',
    title: 'Pathology',
    subTopics: [
      {
        id: 'cell-injury-adaptation',
        title: 'Cell Injury & Adaptation',
        videos: [
          { title: 'Cell Injury', url: 'https://www.youtube.com/watch?v=hhRRQ77e39A' },
        ],
      },
      {
        id: 'inflammation-repair',
        title: 'Inflammation & Repair',
        videos: [
          { title: 'Inflammation', url: 'https://www.youtube.com/watch?v=uEjJc9mt688' },
          { title: 'Healing / Repair', url: 'https://www.youtube.com/watch?v=lDsqM3iar2E' },
        ],
      },
      {
        id: 'hemodynamics',
        title: 'Hemodynamics (Circulatory Disturbances)',
        videos: [
          { title: 'Hemodynamics', url: 'https://www.youtube.com/watch?v=krrA7DFi1u8' },
        ],
      },
      {
        id: 'neoplasia',
        title: 'Neoplasia (Tumors)',
        videos: [
          { title: 'Neoplasm Class 1', url: 'https://www.youtube.com/watch?v=0ZZmR6Dlgo4' },
          { title: 'Neoplasm Class 2', url: 'https://www.youtube.com/watch?v=3441B0bGtmg' },
        ],
      },
      {
        id: 'genetics',
        title: 'Genetics',
        videos: [
          { title: 'Genetics Class 1', url: 'https://www.youtube.com/watch?v=q914xARLI7U' },
          { title: 'Genetics Class 2', url: 'https://www.youtube.com/watch?v=ShSZp3fe5q0' },
        ],
      },
    ],
  },
  {
    id: 'neurosurgery',
    title: 'Neurosurgery',
    subTopics: [
      {
        id: 'basic-neuro',
        title: 'Basic Neuro (Foundation)',
        videos: [
          { title: 'Neuron, Supporting Cell, BBB', url: 'https://www.youtube.com/watch?v=RRLyTEnayQE' },
          { title: 'Nerve Fibre, Neurotransmitter, Receptor, CSF, Golgi Spindle', url: 'https://www.youtube.com/watch?v=rY_A25EbFPE' },
        ],
      },
      {
        id: 'cerebrum-higher-centers',
        title: 'Cerebrum & Higher Centers',
        videos: [
          { title: 'Cerebral Cortex', url: 'https://www.youtube.com/watch?v=e5PQSRxcae4' },
          { title: 'Basal Ganglia, Internal Capsule, Venous Sinus', url: 'https://www.youtube.com/watch?v=aHPtcziuws4' },
          { title: 'Thalamus, Hypothalamus, Cerebellum, Cranial Nerve', url: 'https://www.youtube.com/watch?v=K4DCGQbZ4VM' },
        ],
      },
      {
        id: 'brainstem',
        title: 'Brainstem',
        videos: [
          { title: "Brain Stem, Brain Stem Syndrome, Horner's Syndrome", url: 'https://www.youtube.com/watch?v=DjOjCRThoTI' },
          { title: 'Bulbar & Pseudobulbar Palsy', url: 'https://www.youtube.com/watch?v=UglqxsfNqFs' },
        ],
      },
      {
        id: 'spinal-cord',
        title: 'Spinal Cord',
        videos: [
          { title: 'Spinal Cord - Anatomy', url: 'https://www.youtube.com/watch?v=Gdsa28Ee5BQ' },
          { title: 'Tract (Ascending / Descending)', url: 'https://www.youtube.com/watch?v=TYaJAq6dyfk' },
          { title: 'Spinal Cord - Hemisection', url: 'https://www.youtube.com/watch?v=dYt4Od7XLcU' },
          { title: 'Spinal Cord - Transection', url: 'https://www.youtube.com/watch?v=2q0PdJR1cBQ' },
        ],
      },
      {
        id: 'blood-supply-neurovascular',
        title: 'Blood Supply (Neurovascular)',
        videos: [
          { title: 'Blood Supply of Head, Neck, Brain', url: 'https://www.youtube.com/watch?v=aebOKuZqr38' },
        ],
      },
      {
        id: 'meninges-csf',
        title: 'Meninges & CSF System',
        videos: [
          { title: 'Meninges', url: 'https://www.youtube.com/watch?v=Y9NZ60zx_BQ' },
        ],
      },
      {
        id: 'peripheral-applied-neuro',
        title: 'Peripheral & Applied Neuro',
        videos: [
          { title: 'UB Nerve Supply & Neurogenic Bladder', url: 'https://www.youtube.com/watch?v=XRhz6cS4-0o' },
        ],
      },
      {
        id: 'head-neck-special-senses',
        title: 'Head & Neck / Special Senses',
        videos: [
          { title: 'Special Sense, Larynx, Pharynx, Tongue, Neck', url: 'https://www.youtube.com/watch?v=CSs0q5Nv_fU' },
        ],
      },
    ],
  },
  {
    id: 'pharmacology',
    title: 'Pharmacology',
    subTopics: [
      {
        id: 'general-pharmacology',
        title: 'General Pharmacology',
        videos: [
          { title: 'General Pharmacology', url: 'https://www.youtube.com/watch?v=JlHaQ10e2VA' },
          { title: 'General Pharmacology', url: 'https://www.youtube.com/watch?v=qHBclm25tus' },
        ],
      },
      {
        id: 'ans-pharmacology',
        title: 'Autonomic Nervous System (ANS) Pharmacology',
        videos: [
          { title: 'Autonomic Pharmacology', url: 'https://www.youtube.com/watch?v=usOowSnXJiw' },
        ],
      },
      {
        id: 'cardiovascular-pharmacology',
        title: 'Cardiovascular Pharmacology',
        videos: [
          { title: 'Cardiac Pharmacology', url: 'https://www.youtube.com/watch?v=wfmeVW1hQuk' },
        ],
      },
      {
        id: 'systemic-pharmacology',
        title: 'Systemic Pharmacology',
        videos: [
          { title: 'Respiratory, Renal, Gastro, Endocrine Pharmacology', url: 'https://www.youtube.com/watch?v=gWOCI7KcZzM' },
        ],
      },
      {
        id: 'cns-inflammatory-pharmacology',
        title: 'CNS & Inflammatory Pharmacology',
        videos: [
          { title: 'NSAIDs, CNS Drugs (Antidepressants, Antipsychotics, Sedatives)', url: 'https://www.youtube.com/watch?v=-EXf6V-Zrlk' },
        ],
      },
    ],
  },
  {
    id: 'microbiology',
    title: 'Microbiology',
    subTopics: [
      {
        id: 'general-microbiology',
        title: 'General Microbiology (Basics)',
        videos: [
          { title: 'General Bacteriology', url: 'https://www.youtube.com/watch?v=T3v5I6IZz0o' },
        ],
      },
      {
        id: 'bacteriology-systemic',
        title: 'Bacteriology (Systemic)',
        videos: [
          { title: 'Systemic Bacteriology 1', url: 'https://www.youtube.com/watch?v=1RkT-p7Vwkw' },
          { title: 'Systemic Bacteriology 2', url: 'https://www.youtube.com/watch?v=nh98NNjj-kk' },
          { title: 'Systemic Bacteriology 3', url: 'https://www.youtube.com/watch?v=4GK7FkN_wmg' },
        ],
      },
      {
        id: 'virology',
        title: 'Virology',
        videos: [
          { title: 'Virology Class 1', url: 'https://www.youtube.com/watch?v=EXBbV2lgY9E' },
          { title: 'Virology Class 2', url: 'https://www.youtube.com/watch?v=8wujb_YinOs' },
          { title: 'Virology Class 3', url: 'https://www.youtube.com/watch?v=6Y5o9nB72z4' },
          { title: 'Virology Class 4 - HIV (AIDS)', url: 'https://www.youtube.com/watch?v=z4V_Dod97Kc' },
        ],
      },
      {
        id: 'parasitology',
        title: 'Parasitology',
        videos: [
          { title: 'Parasitology', url: 'https://www.youtube.com/watch?v=em5cxn1Y38I' },
        ],
      },
      {
        id: 'mycology',
        title: 'Mycology (Fungi)',
        videos: [
          { title: 'Mycology', url: 'https://www.youtube.com/watch?v=AdDOay3OI84' },
        ],
      },
      {
        id: 'infectious-disease-groups',
        title: 'Infectious Disease Groups (Clinical Micro)',
        videos: [
          { title: 'Infectious Zoonotic Disease', url: 'https://www.youtube.com/watch?v=PPCPGmFcxrQ' },
          { title: 'Sexually Transmitted Diseases (STD)', url: 'https://www.youtube.com/watch?v=tAFMPLWyySk' },
        ],
      },
      {
        id: 'immunology',
        title: 'Immunology',
        videos: [
          { title: 'Immunology Class 1', url: 'https://www.youtube.com/watch?v=crdcu4E5fuU' },
          { title: 'Immunology Class 2', url: 'https://www.youtube.com/watch?v=QxA9HA_S1F0' },
        ],
      },
    ],
  },
  {
    id: 'biostatistics',
    title: 'Biostatistics',
    subTopics: [
      {
        id: 'biostatistics-class-1',
        title: 'Biostatistics Class 1',
        videos: [
          { title: 'Biostatistics Class 1', url: 'https://www.youtube.com/watch?v=fo02OaC4pJ4' },
        ],
      },
      {
        id: 'biostatistics-class-2',
        title: 'Biostatistics Class 2',
        videos: [
          { title: 'Biostatistics Class 2', url: 'https://www.youtube.com/watch?v=XozXRyj1czc' },
        ],
      },
    ],
  },
];

const applyGroupToSubtree = (node: BuilderCurriculumNode, groupId: string): BuilderCurriculumNode => ({
  ...node,
  releaseGroupId: groupId,
  children: (node.children || []).map((child) => applyGroupToSubtree(child, groupId)),
});

const createVideoNode = (video: StarterVideo): BuilderCurriculumNode => ({
  id: createNodeId('video'),
  title: video.title,
  type: 'youtube',
  url: video.url,
  duration: null,
  releaseAt: null,
  releaseGroupId: null,
  children: [],
});

export function getStarterCatalogSummary() {
  return STARTER_CATALOG.map((topic) => ({
    id: topic.id,
    title: topic.title,
    subTopicCount: topic.subTopics.length,
    videoCount: topic.subTopics.reduce((total, subTopic) => total + subTopic.videos.length, 0),
  }));
}

export function buildCurriculumFromStarter(mainTopicIds: string[]): BuilderCurriculumNode[] {
  const selected = STARTER_CATALOG.filter((topic) => mainTopicIds.includes(topic.id));

  return selected.map((mainTopic) => {
    const mainNode: BuilderCurriculumNode = {
      id: createNodeId(`main_${slugify(mainTopic.title)}`),
      title: mainTopic.title,
      type: 'folder',
      releaseGroupId: null,
      releaseAt: null,
      children: [],
    };

    const children: BuilderCurriculumNode[] = mainTopic.subTopics.map((subTopic) => {
      const groupId = `group_${slugify(mainTopic.title)}_${slugify(subTopic.title)}_${createNodeId('grp').slice(-6)}`;
      const shouldFlatten = !subTopic.forceFolder && subTopic.videos.length === 1;

      if (shouldFlatten) {
        const onlyVideo = subTopic.videos[0];
        const videoNode: BuilderCurriculumNode = {
          ...createVideoNode(onlyVideo),
          title: subTopic.title,
        };
        return applyGroupToSubtree(videoNode, groupId);
      }

      const folderNode: BuilderCurriculumNode = {
        id: createNodeId(`sub_${slugify(subTopic.title)}`),
        title: subTopic.title,
        type: 'folder',
        releaseAt: null,
        releaseGroupId: groupId,
        children: subTopic.videos.map((video) => createVideoNode(video)),
      };

      return applyGroupToSubtree(folderNode, groupId);
    });

    return {
      ...mainNode,
      children,
    };
  });
}
