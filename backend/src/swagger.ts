import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import path from 'path';
import type { Express } from 'express';

const components = {
  schemas: {
    Mentor: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'm_1001' },
        name: { type: 'string', example: 'Sarah Chen' },
        slack_id: { type: 'string', example: 'U001' },
      },
      required: ['id', 'name', 'slack_id'],
    },
    Course: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'crs_oulad' },
        name: { type: 'string' },
        total_modules: { type: 'integer', example: 9 },
        duration_weeks: { type: 'integer', example: 6 },
        format: { type: 'string', enum: ['bootcamp', 'self_paced', 'live'] },
      },
      required: ['id', 'name', 'total_modules', 'duration_weeks', 'format'],
    },
    Student: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'stud_134143' },
        name: { type: 'string' },
        email: { type: 'string', format: 'email' },
        slack_id: { type: 'string' },
        course_id: { type: 'string' },
        mentor_id: { type: 'string' },
        enrollment_date: { type: 'string', format: 'date' },
        current_module: { type: 'integer' },
        status: { type: 'string', enum: ['active', 'paused', 'dropped', 'completed'] },
        created_at: { type: 'string', format: 'date-time' },
        updated_at: { type: 'string', format: 'date-time' },
      },
      required: [
        'id',
        'name',
        'email',
        'slack_id',
        'course_id',
        'mentor_id',
        'enrollment_date',
        'current_module',
        'status',
      ],
    },
    Homework: {
      type: 'object',
      properties: {
        id: { type: 'integer', format: 'int64' },
        student_id: { type: 'string' },
        hw_id: { type: 'string', example: 'hw_1752' },
        module: { type: 'integer' },
        title: { type: 'string' },
        topic: { type: 'string' },
        deadline: { type: 'string', format: 'date' },
        submitted_at: { type: 'string', format: 'date-time', nullable: true },
        status: { type: 'string', enum: ['missed', 'late', 'submitted', 'graded'] },
        grade: { type: 'integer', nullable: true },
      },
      required: ['id', 'student_id', 'hw_id', 'module', 'title', 'topic', 'deadline', 'status'],
    },
    SlackMessage: {
      type: 'object',
      properties: {
        id: { type: 'integer', format: 'int64' },
        student_id: { type: 'string' },
        channel_type: { type: 'string', enum: ['mentor_dm', 'group_chat', 'support_chat'] },
        is_from_student: { type: 'boolean' },
        message_text: { type: 'string' },
        sent_at: { type: 'string', format: 'date-time' },
        mentioned_mentor: { type: 'boolean' },
      },
      required: [
        'id',
        'student_id',
        'channel_type',
        'is_from_student',
        'message_text',
        'sent_at',
        'mentioned_mentor',
      ],
    },
    VleSite: {
      type: 'object',
      properties: {
        id_site: { type: 'integer' },
        activity_type: { type: 'string', example: 'forumng' },
        week_from: { type: 'integer', nullable: true },
        week_to: { type: 'integer', nullable: true },
      },
      required: ['id_site', 'activity_type'],
    },
    LoginEvent: {
      type: 'object',
      properties: {
        id: { type: 'integer', format: 'int64' },
        student_id: { type: 'string' },
        id_site: { type: 'integer' },
        occurred_on: { type: 'string', format: 'date' },
        sum_clicks: { type: 'integer' },
      },
      required: ['id', 'student_id', 'id_site', 'occurred_on', 'sum_clicks'],
    },
    PaginatedMeta: {
      type: 'object',
      properties: {
        total: { type: 'integer', example: 15 },
        limit: { type: 'integer', example: 50 },
        offset: { type: 'integer', example: 0 },
      },
      required: ['total', 'limit', 'offset'],
    },
    ErrorResponse: {
      type: 'object',
      properties: {
        error: { type: 'string', example: 'not found' },
        resource: { type: 'string', example: 'student' },
        id: { type: 'string', example: 'stud_999' },
      },
      required: ['error'],
    },
  },
  parameters: {
    LimitParam: {
      name: 'limit',
      in: 'query',
      schema: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
      description: 'Max rows to return (max 200).',
    },
    OffsetParam: {
      name: 'offset',
      in: 'query',
      schema: { type: 'integer', minimum: 0, default: 0 },
      description: 'Rows to skip.',
    },
  },
};

const spec = swaggerJsdoc({
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'data-api',
      version: '0.1.0',
      description:
        'Read-only API over the retention-platform Postgres database ' +
        '(students, courses, mentors, homework, slack messages, VLE sites, login events).',
    },
    servers: [
      { url: '/', description: 'Same origin (recommended — use whichever host you loaded /docs from)' },
      { url: 'http://localhost:3000', description: 'Local dev (direct)' },
    ],
    components,
    tags: [
      { name: 'health', description: 'Liveness + DB ping' },
      { name: 'students', description: 'Students and their per-student timelines' },
      { name: 'courses', description: 'Course catalog' },
      { name: 'mentors', description: 'Mentors' },
      { name: 'homework', description: 'Homework assignments and grades' },
      { name: 'slack-messages', description: 'Slack chat history' },
      { name: 'vle-sites', description: 'VLE (LMS) site dimension' },
      { name: 'login-events', description: 'Daily per-site click counts' },
      { name: 'metrics', description: 'Per-student key calculations (joined from 4 VIEWs)' },
    ],
  },
  apis: [path.join(__dirname, 'routes/*.{ts,js}')],
});

export function mountSwagger(app: Express): void {
  app.get('/openapi.json', (_req, res) => res.json(spec));
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(spec, { customSiteTitle: 'data-api docs' }));
}
