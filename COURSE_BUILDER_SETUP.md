# Teacher Course Builder - Setup Instructions

## 🚀 Quick Start After Code Update

### Step 1: Database Migration (CRITICAL)
Run this command to create the database migration for new schema changes:

```bash
cd /path/to/CreativeByDrShakil

# Apply any pending migrations first
npx prisma migrate deploy

# If that fails or shows no pending migrations, create a new one:
npx prisma migrate dev --name add_category_instructor_models
```

This will:
- Add `Category` table
- Add `CourseInstructor` table  
- Add new fields to `Course` table (courseStartDate, salePrice, overview, learningOutcomes)
- Regenerate Prisma Client

### Step 2: Verify Everything
After the migration, verify no TypeScript errors:

```bash
npm run build
```

This should compile without errors. If you still see Prisma client errors, run:

```bash
npx prisma generate
```

### Step 3: Seed Categories (Optional but Recommended)
Create some initial categories so teachers can select them:

```bash
# Run from Node REPL or create a seed script
npx prisma db seed
```

Or manually add via Prisma Studio:
```bash
npx prisma studio
```

Then add categories like:
- FCPS
- Medicine
- Surgery
- Pediatrics
- etc.

## Testing Path

1. **Navigate to Teacher Courses**
   ```
   /teacher/dashboard?tab=courses
   ```

2. **Create First Course**
   - Click "Create Your First Course" button
   - Fill Step 1: Title, Category, Price, Duration, Start Date, Thumbnail
   - Click "Next"

3. **Add Content**  
   - Step 2: Overview (free text), Learning Outcomes (bullet points), Instructors
   - Can add multiple instructors with designation
   - Click "Next"

4. **Review & Publish**
   - Step 3: Review all course data
   - Click "Publish Course"
   - Redirects to courses list

## Features Implemented ✅

### Database
- [x] Category model with displayName
- [x] CourseInstructor model for multiple instructors
- [x] New course fields: courseStartDate, salePrice, overview, learningOutcomes
- [x] Updated course status with categoryId foreign key

### API Endpoints
- [x] GET/POST /api/categories
- [x] POST /api/teacher/courses (updated for new fields)
- [x] GET /api/teacher/courses (returns instructors & category)
- [x] GET /api/teacher/courses/[courseId] (includes instructors & category)
- [x] POST /api/teacher/courses/[courseId]/content (save step 2)
- [x] POST /api/teacher/courses/[courseId]/publish (publish course)
- [x] PUT /api/teacher/courses/[courseId] (update course, not used in UI yet)
- [x] DELETE /api/teacher/courses/[courseId] (delete draft courses)

### Components
- [x] CoursesTab.tsx — Display existing courses + add button
- [x] CreateCourseStep1.tsx — Basic info form
- [x] CreateCourseStep2.tsx — Overview & instructors 
- [x] CreateCourseStep3.tsx — Review & publish

### Pages
- [x] /teacher/dashboard/courses/create (Step 1)
- [x] /teacher/dashboard/courses/create/content (Step 2)
- [x] /teacher/dashboard/courses/create/outline (Step 3)

### Integration  
- [x] Dashboard courses tab integrated with CoursesTab component
- [x] Dark/light mode toggle already in place

## Troubleshooting

### "Cannot find module 'react-quill'"
Already fixed - using textarea instead of WYSIWYG editor. No additional packages needed.

### Prisma Client Errors After Migration
```bash
npx prisma generate
```

### Database Connection Issues
Verify DATABASE_URL and DIRECT_URL in .env.local are correct

### Images Not Uploading
Ensure /api/upload endpoint exists (may need to create if not present)

## File Structure Created

```
src/
  app/
    api/
      categories/
        route.ts ← NEW
      teacher/
        courses/
          [courseId]/
            content/
              route.ts ← NEW
            publish/
              route.ts ← NEW
    teacher/
      dashboard/
        courses/
          create/
            page.tsx ← MODIFIED (Step 1)
            content/
              page.tsx ← NEW (Step 2)
            outline/
              page.tsx ← NEW (Step 3)
  components/
    Teacher/
      CoursesTab.tsx ← NEW
      CoursesTab.module.css ← NEW
      CreateCourseStep1.tsx ← NEW
      CreateCourseStep1.module.css ← NEW
      CreateCourseStep2.tsx ← NEW
      CreateCourseStep2.module.css ← NEW
      CreateCourseStep3.tsx ← NEW
      CreateCourseStep3.module.css ← NEW

prisma/
  schema.prisma ← UPDATED (added Category, CourseInstructor, new fields)
```

## Next Enhancement Ideas

- [ ] Add course thumbnail picker UI
- [ ] Implement /api/upload endpoint if missing
- [ ] Add WYSIWYG editor (react-quill) for rich text
- [ ] Course curriculum/lessons management (already scaffolded)
- [ ] Course duplication feature
- [ ] Bulk course actions
- [ ] Course analytics dashboard
