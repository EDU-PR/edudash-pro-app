# EduDash Pro Textbook Library - Status Report

## Database Status
- **Total Textbooks**: 37 books in database
- **With PDFs**: 6 books (16%)
- **Without PDFs**: 31 books (84%)

## Table Structure
Table: `textbooks`
- Uses same structure as described in create-books-table.js
- Fields: id, title, grade, subject, language, publisher, isbn, cover_url, pdf_url, file_size, page_count, description, caps_approved, publication_year
- RLS enabled with public read access

## Current Features (Parent EBooks Page)

### ✅ Working Features:
1. **Book Browsing**
   - Grid display with book covers
   - Filter by grade (R-12)
   - Filter by subject (Math, English, Science, etc.)
   - Filter by language (11 SA languages)
   - Search by title, subject, or publisher
   - CAPS badge for approved textbooks
   - Bookmark functionality (saves to `user_bookmarks` table)

2. **Book Viewing**
   - Opens PDF in new tab when `pdf_url` exists
   - Shows helpful message when PDF not available
   - Download button for offline access
   - Page count and file size displayed

3. **AI Integration**
   - "Generate Exam from This Book" button
   - Links to exam prep with book context
   - Works even without PDF (uses metadata)

### ⚠️ Limitations:
1. **Most Books Missing PDFs**
   - Only 6/37 books have actual PDF URLs
   - Other books show "Soon" placeholder
   - Users alerted that book is being prepared

2. **No Built-in PDF Viewer**
   - Currently opens PDFs in new tab
   - No in-app reading experience
   - No annotations or highlights

3. **No Dash Diagram Generation**
   - Dash can't currently extract content from textbooks
   - No diagram generation from textbook topics
   - Missing visual learning aids

## Recommendations

### Priority 1: Add In-App PDF Viewer
- Use react-pdf or pdf.js
- Enable page navigation
- Add zoom controls
- Mobile-optimized reading

### Priority 2: Dash Diagram Generation
- Add tool to Dash AI that can:
  - Extract topics from textbook metadata
  - Generate Mermaid diagrams for concepts
  - Create flowcharts, mind maps, timelines
  - Visualize relationships between topics
- Example: "Generate a diagram explaining photosynthesis from Grade 10 Life Sciences"

### Priority 3: Populate Missing PDFs
- Partner with DBE for official textbooks
- Scrape publicly available CAPS textbooks
- Link to official government resources
- Or use placeholder content with Dash-generated summaries

### Priority 4: Enhanced AI Features
- Textbook Q&A (ask questions about specific chapters)
- Auto-generate flashcards from textbook content
- Practice problems based on textbook exercises
- Study guides per chapter

## Technical Implementation (Dash Diagrams)

### New Tool for DashToolRegistry:
```typescript
{
  name: 'generate_textbook_diagram',
  description: 'Generate educational diagrams from textbook topics',
  inputSchema: {
    textbook_id: 'string (UUID)',
    topic: 'string (e.g., "photosynthesis", "Pythagorean theorem")',
    diagram_type: '"flowchart" | "mindmap" | "timeline" | "concept-map"'
  },
  riskLevel: 'low',
  execute: async ({ textbook_id, topic, diagram_type }) => {
    // 1. Fetch textbook metadata
    // 2. Use Claude to generate diagram in Mermaid syntax
    // 3. Return Mermaid code for rendering
    // 4. Log to ai_events table
  }
}
```

### Diagram Types to Support:
1. **Flowcharts** - Process explanations (e.g., water cycle)
2. **Mind Maps** - Topic relationships (e.g., branches of government)
3. **Timelines** - Historical events or scientific discoveries
4. **Concept Maps** - Connections between ideas
5. **Class Diagrams** - Hierarchies (e.g., animal classification)
6. **Sequence Diagrams** - Step-by-step processes

## Next Steps
1. ✅ Fix auto-rotate issue (Done - changed to "default")
2. ⏳ Verify syntax highlighting in Dash chat
3. ⏳ Implement in-app PDF viewer
4. ⏳ Add Dash diagram generation tool
5. ⏳ Populate missing textbook PDFs
