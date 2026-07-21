const fs = require('fs');
const path = require('path');

const adminDir = 'c:/GitHub/CreativeByDrShakil/src/app/admin/dashboard';
const studentDir = 'c:/GitHub/CreativeByDrShakil/src/app/dashboard';
const teacherDir = 'c:/GitHub/CreativeByDrShakil/src/app/teacher/dashboard';

function createPage(dir, name, content) {
    const pageDir = path.join(dir, name);
    if (!fs.existsSync(pageDir)) fs.mkdirSync(pageDir, { recursive: true });
    fs.writeFileSync(path.join(pageDir, 'page.tsx'), content);
}

// ADMIN PAGES
createPage(adminDir, 'users', `"use client";\nimport UsersManager from "@/components/Shared/UsersManager";\nimport styles from "../AdminDashboard.module.css";\n\nexport default function UsersPage() {\n    return (\n        <section className={styles.panel}>\n            <div className={styles.panelHeader}>\n                <div>\n                    <h2 className={styles.panelTitle}>User Directory</h2>\n                    <p className={styles.subtitle}>Active device sessions and enrolled programs</p>\n                </div>\n            </div>\n            <UsersManager />\n        </section>\n    );\n}`);

createPage(adminDir, 'students', `"use client";\nimport StudentsManager from "@/components/Shared/StudentsManager";\nimport styles from "../AdminDashboard.module.css";\n\nexport default function StudentsPage() {\n    return (\n        <section className={styles.panel}>\n            <div className={styles.panelHeader}>\n                <div>\n                    <h2 className={styles.panelTitle}>Student Directory</h2>\n                    <p className={styles.subtitle}>Enrolled students and user accounts</p>\n                </div>\n            </div>\n            <StudentsManager />\n        </section>\n    );\n}`);

createPage(adminDir, 'enrollments', `"use client";\nimport EnrollmentsManager from "@/components/Shared/EnrollmentsManager";\nimport styles from "../AdminDashboard.module.css";\n\nexport default function EnrollmentsPage() {\n    return (\n        <section className={styles.panel}>\n            <div className={styles.panelHeader}>\n                <div>\n                    <h2 className={styles.panelTitle}>Enrollments Manager</h2>\n                    <p className={styles.subtitle}>Manage student course enrollments and progress.</p>\n                </div>\n            </div>\n            <EnrollmentsManager />\n        </section>\n    );\n}`);

createPage(adminDir, 'payments', `"use client";\nimport PaymentsManager from "@/components/Admin/PaymentsManager";\n\nexport default function PaymentsPage() {\n    return <PaymentsManager />;\n}`);

createPage(adminDir, 'support', `"use client";\nimport ContactRequestsManager from "@/components/Admin/ContactRequestsManager";\nimport styles from "../AdminDashboard.module.css";\n\nexport default function SupportPage() {\n    return (\n        <section className={styles.panel}>\n            <h2 className={styles.panelTitle}>Inbound Help Requests</h2>\n            <ContactRequestsManager />\n        </section>\n    );\n}`);

createPage(adminDir, 'settings', `"use client";\nimport BkashSettings from "@/components/Admin/BkashSettings";\nimport styles from "../AdminDashboard.module.css";\n\nexport default function SettingsPage() {\n    return (\n        <section className={styles.panel}>\n            <h2 className={styles.panelTitle}>Platform Financials</h2>\n            <BkashSettings />\n        </section>\n    );\n}`);

createPage(adminDir, 'security', `"use client";\nimport PasswordManager from "@/components/Shared/PasswordManager";\n\nexport default function SecurityPage() {\n    return <PasswordManager />;\n}`);

createPage(adminDir, 'profile', `"use client";\nimport ProfileTab from "@/components/Shared/ProfileTab";\n\nexport default function ProfilePage() {\n    return <ProfileTab />;\n}`);

// Loading skeleton for all dashboards
const loadingContent = `import { CardSkeleton } from "@/components/UI/Skeleton";\n\nexport default function Loading() {\n    return (\n        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '20px' }}>\n            <CardSkeleton />\n            <CardSkeleton />\n        </div>\n    );\n}`;

fs.writeFileSync(path.join(adminDir, 'loading.tsx'), loadingContent);
fs.writeFileSync(path.join(studentDir, 'loading.tsx'), loadingContent);
fs.writeFileSync(path.join(teacherDir, 'loading.tsx'), loadingContent);

console.log('Pages created successfully.');
