// ===== VIDHYAPATH ADAPTIVE LEARNING AUTOMATED TEST SUITE =====
const assert = require('assert');
const http = require('http');
const path = require('path');
const fs = require('fs');

console.log('🧪 Starting VidhyaPath Adaptive Learning Test Suite...\n');

let testsPassed = 0;
let testsFailed = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    testsFailed++;
  }
}

async function runAsyncTest(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    testsFailed++;
  }
}

// ===== 1. CLIENT ADAPTIVE HEURISTICS TESTS =====
console.log('--- Suite 1: Client Adaptive Heuristics Engine ---');

const AdaptiveUI = require('../js/adaptiveUI');

runTest('AdaptiveUI defines core mode thresholds correctly', () => {
  assert(AdaptiveUI.THRESHOLDS, 'THRESHOLDS object must be exported');
  assert.strictEqual(AdaptiveUI.THRESHOLDS.STRUGGLING.accuracy, 50);
  assert.strictEqual(AdaptiveUI.THRESHOLDS.STRUGGLING.responseTime, 25000);
  assert.strictEqual(AdaptiveUI.THRESHOLDS.PROGRESSING.accuracy, 65);
  assert.strictEqual(AdaptiveUI.THRESHOLDS.EXCELLING.accuracy, 80);
  assert.strictEqual(AdaptiveUI.THRESHOLDS.EXCELLING.responseTime, 8000);
});

runTest('AdaptiveUI maps difficulty correctly from modes', () => {
  assert.strictEqual(AdaptiveUI.getDifficultyFromMode('struggling'), 'easy');
  assert.strictEqual(AdaptiveUI.getDifficultyFromMode('progressing'), 'easy');
  assert.strictEqual(AdaptiveUI.getDifficultyFromMode('performing'), 'medium');
  assert.strictEqual(AdaptiveUI.getDifficultyFromMode('excelling'), 'hard');
  assert.strictEqual(AdaptiveUI.getDifficultyFromMode('unknown'), 'medium');
});

runTest('AdaptiveUI mode configurations have required attributes', () => {
  const modes = ['struggling', 'progressing', 'performing', 'excelling'];
  modes.forEach(mode => {
    const config = AdaptiveUI.UI_MODES[mode];
    assert(config, `Mode ${mode} must exist`);
    assert(config.name, `Mode ${mode} must have a name`);
    assert(config.color, `Mode ${mode} must have a theme color`);
    assert(config.emoji, `Mode ${mode} must have an emoji`);
    assert(Array.isArray(config.actions), `Mode ${mode} must have an actions list`);
  });
});

runTest('AdaptiveUI streak overrides force struggling or excelling mode', () => {
  // 3 consecutive wrongs forces struggling even with high accuracy
  const modeWrongStreak = AdaptiveUI.analyze({
    accuracy: 85,
    avgResponseTime: 6000,
    consecutiveWrong: 3,
    consecutiveCorrect: 0
  });
  assert.strictEqual(modeWrongStreak, 'struggling', '3 consecutive wrong answers must trigger struggling mode');

  // 8 consecutive correct answers promotes to excelling
  const modeCorrectStreak = AdaptiveUI.analyze({
    accuracy: 75,
    avgResponseTime: 9500,
    consecutiveWrong: 0,
    consecutiveCorrect: 8
  });
  assert.strictEqual(modeCorrectStreak, 'excelling', '8 consecutive correct answers must trigger excelling mode');
});

runTest('AdaptiveUI getModeColor and getModeEmoji provide UI styling with fallbacks', () => {
  assert.strictEqual(AdaptiveUI.getModeColor('struggling'), '#FF6B6B');
  assert.strictEqual(AdaptiveUI.getModeColor('excelling'), '#6C63FF');
  assert.strictEqual(AdaptiveUI.getModeEmoji('struggling'), '🌱');
  assert.strictEqual(AdaptiveUI.getModeEmoji('excelling'), '🚀');

  // Unknown mode fallbacks
  assert.strictEqual(AdaptiveUI.getModeColor('invalid_mode'), '#6C63FF');
  assert.strictEqual(AdaptiveUI.getModeEmoji('invalid_mode'), '📚');
});

runTest('AdaptiveUI timer multiplier and hints assistance behave correctly across modes', () => {
  // Timer multipliers
  assert.strictEqual(AdaptiveUI.getTimerMultiplier('struggling'), 1.5, 'Struggling learners get 1.5x time');
  assert.strictEqual(AdaptiveUI.getTimerMultiplier('progressing'), 1.2, 'Progressing learners get 1.2x time');
  assert.strictEqual(AdaptiveUI.getTimerMultiplier('performing'), 1.0, 'Performing learners get 1.0x standard time');
  assert.strictEqual(AdaptiveUI.getTimerMultiplier('excelling'), 0.85, 'Excelling learners get 0.85x challenge time');
  assert.strictEqual(AdaptiveUI.getTimerMultiplier('unrecognized_mode'), 1.0, 'Fallback timer multiplier is 1.0');

  // Hints
  assert.strictEqual(AdaptiveUI.shouldShowHints('struggling'), true, 'Struggling learners must receive hints');
  assert.strictEqual(AdaptiveUI.shouldShowHints('progressing'), true, 'Progressing learners must receive hints');
  assert.strictEqual(AdaptiveUI.shouldShowHints('performing'), false, 'Performing learners do not receive hints');
  assert.strictEqual(AdaptiveUI.shouldShowHints('excelling'), false, 'Excelling learners do not receive hints');
});

// ===== 2. BACKEND API & ROUTE TESTS =====
console.log('\n--- Suite 2: Express Backend API & Endpoints ---');

const app = require('../backend/server');

function makeRequest(server, options, postData = null) {
  return new Promise((resolve, reject) => {
    const port = server.address().port;
    const reqOptions = {
      hostname: '127.0.0.1',
      port: port,
      path: options.path,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    };

    const req = http.request(reqOptions, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(body);
        } catch (e) {
          parsed = body;
        }
        resolve({ status: res.statusCode, data: parsed, headers: res.headers });
      });
    });

    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

(async () => {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    await runAsyncTest('GET /api/health returns 200 OK and mission status', async () => {
      const res = await makeRequest(server, { path: '/api/health', method: 'GET' });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.status, 'OK');
      assert.strictEqual(res.data.platform, 'VidhyaPath');
      assert(res.data.mission.includes('NEP 2020'), 'Mission must mention NEP 2020');
    });

    await runAsyncTest('POST /api/adaptive/analyze detects struggling learner', async () => {
      const payload = {
        accuracy: 35,
        avgResponseTime: 28000,
        consecutiveCorrect: 0,
        consecutiveWrong: 3
      };
      const res = await makeRequest(server, { path: '/api/adaptive/analyze', method: 'POST' }, payload);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.mode, 'struggling');
      assert.strictEqual(res.data.difficulty, 'easy');
      assert.strictEqual(res.data.recommendation.enableSimpleMode, true);
      assert.strictEqual(res.data.recommendation.fontIncrease, true);
    });

    await runAsyncTest('POST /api/adaptive/analyze detects excelling learner', async () => {
      const payload = {
        accuracy: 92,
        avgResponseTime: 6500,
        consecutiveCorrect: 6,
        consecutiveWrong: 0
      };
      const res = await makeRequest(server, { path: '/api/adaptive/analyze', method: 'POST' }, payload);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.mode, 'excelling');
      assert.strictEqual(res.data.difficulty, 'hard');
      assert.strictEqual(res.data.recommendation.unlockNextLesson, true);
    });

    await runAsyncTest('POST /api/student creates or updates student profile', async () => {
      const studentPayload = {
        id: 'test-student-42',
        name: 'Aarav Sharma',
        avatar: '👨‍🎓',
        settings: { simpleMode: false, highContrast: false },
        progress: { totalPoints: 120, lessonsCompleted: 3 }
      };
      const res = await makeRequest(server, { path: '/api/student', method: 'POST' }, studentPayload);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);
      assert.strictEqual(res.data.student.name, 'Aarav Sharma');
    });

    await runAsyncTest('GET /api/student/:id retrieves existing student profile', async () => {
      const res = await makeRequest(server, { path: '/api/student/test-student-42', method: 'GET' });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.id, 'test-student-42');
      assert.strictEqual(res.data.name, 'Aarav Sharma');
    });

    await runAsyncTest('POST /api/session logs student quiz attempt', async () => {
      const sessionPayload = {
        studentId: 'test-student-42',
        quizId: 'quiz-science-01',
        score: 90,
        accuracy: 90,
        avgResponseTime: 7200
      };
      const res = await makeRequest(server, { path: '/api/session', method: 'POST' }, sessionPayload);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);
      assert(res.data.sessionId, 'sessionId must be returned');
    });

    await runAsyncTest('GET /api/leaderboard returns ranked student leaderboard', async () => {
      const res = await makeRequest(server, { path: '/api/leaderboard', method: 'GET' });
      assert.strictEqual(res.status, 200);
      assert(Array.isArray(res.data), 'Leaderboard must be an array');
    });

    await runAsyncTest('POST /api/student returns 400 when student ID is missing', async () => {
      const res = await makeRequest(server, { path: '/api/student', method: 'POST' }, { name: 'Anonymous' });
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.data.error, 'Student ID required');
    });

    await runAsyncTest('PUT /api/student/:id/progress updates existing student score', async () => {
      const updatePayload = { totalPoints: 250, lessonsCompleted: 5 };
      const res = await makeRequest(server, { path: '/api/student/test-student-42/progress', method: 'PUT' }, updatePayload);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);

      // Verify updated values via GET
      const verifyRes = await makeRequest(server, { path: '/api/student/test-student-42', method: 'GET' });
      assert.strictEqual(verifyRes.data.progress.totalPoints, 250);
      assert.strictEqual(verifyRes.data.progress.lessonsCompleted, 5);
    });

    await runAsyncTest('PUT /api/student/:id/progress returns 404 for missing student', async () => {
      const res = await makeRequest(server, { path: '/api/student/missing-student-999/progress', method: 'PUT' }, { totalPoints: 10 });
      assert.strictEqual(res.status, 404);
      assert.strictEqual(res.data.error, 'Student not found');
    });

    await runAsyncTest('GET /api/sessions/:studentId retrieves student quiz history', async () => {
      const res = await makeRequest(server, { path: '/api/sessions/test-student-42', method: 'GET' });
      assert.strictEqual(res.status, 200);
      assert(Array.isArray(res.data), 'Sessions must be an array');
      assert(res.data.length >= 1, 'Should find at least 1 session for test student');
      assert.strictEqual(res.data[0].studentId, 'test-student-42');
    });

    await runAsyncTest('POST /api/adaptive/analyze correctly identifies progressing and performing modes', async () => {
      // Progressing mode
      const progressingRes = await makeRequest(server, { path: '/api/adaptive/analyze', method: 'POST' }, {
        accuracy: 58,
        avgResponseTime: 14000,
        consecutiveCorrect: 2,
        consecutiveWrong: 1
      });
      assert.strictEqual(progressingRes.data.mode, 'progressing');
      assert.strictEqual(progressingRes.data.difficulty, 'easy');

      // Performing mode
      const performingRes = await makeRequest(server, { path: '/api/adaptive/analyze', method: 'POST' }, {
        accuracy: 74,
        avgResponseTime: 10000,
        consecutiveCorrect: 3,
        consecutiveWrong: 0
      });
      assert.strictEqual(performingRes.data.mode, 'performing');
      assert.strictEqual(performingRes.data.difficulty, 'medium');
    });

  } finally {
    server.close();
    const dbPath = path.join(__dirname, '../backend/db.json');
    if (fs.existsSync(dbPath)) {
      try { fs.unlinkSync(dbPath); } catch {}
    }
  }

  console.log('\n================================');
  console.log(`Results: ${testsPassed} passed, ${testsFailed} failed`);
  console.log('================================');

  if (testsFailed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
})();
