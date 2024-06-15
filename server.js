const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const User = require('./src/store/UserStore');
const Counter = require('./src/store/Counter'); // Counter 모델 임포트
const MyRecipe = require('./src/store/MyRecipe'); // MyRecipe 모델 임포트
const cors = require('cors');
const bcrypt = require('bcrypt');
const multer = require('multer'); // multer 임포트
const path = require('path');
const jwt = require('jsonwebtoken');

const app = express();
const port = 8080;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cors());

mongoose
  .connect(
    'mongodb+srv://ohtail:wCvHp9yQNPDK7wOp@cluster0.yzwdj7o.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0',
    {}
  )
  .then(() => console.log('MongoDB 연결 성공'))
  .catch((err) => console.error('MongoDB 연결 실패:', err));

//multer 설정
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); // 파일을 uploads 폴더로 저장
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname)); // 파일 이름을 현재 시간 + 원래 파일 확장자로 설정
  },
});

const upload = multer({ storage: storage });

// 회원가입
app.post('/signup', async (req, res) => {
  const { userid, password, email, phonenumber } = req.body;

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res
        .status(400)
        .json({ success: false, message: '이미 존재하는 이메일입니다.' });
    }

    // 비밀번호 해싱
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    console.log('해싱된 비밀번호:', hashedPassword);

    // 유저 번호 증가
    const counter = await Counter.findByIdAndUpdate(
      { _id: 'userId' },
      { $inc: { sequence_value: 1 } },
      { new: true, upsert: true }
    );

    const newUser = new User({
      userid: counter.sequence_value,
      password: hashedPassword,
      email,
      phonenumber,
    });

    await newUser.save();

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('회원가입 오류:', error);
    res.status(500).json({
      success: false,
      message: '회원가입 중 오류가 발생했습니다.',
      error: error.message,
    });
  }
});

// 로그인
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    console.log('로그인 요청 받음:', { email, password }); // 요청 도착 확인용 로그

    const user = await User.findOne({ email });
    console.log('사용자 찾기 결과:', user); // 사용자 찾기 결과 로그

    if (!user) {
      console.log('사용자를 찾을 수 없습니다:', email);
      return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    console.log('비밀번호 비교 결과:', passwordMatch); // 비밀번호 비교 결과 로그

    if (passwordMatch) {
      console.log('로그인 성공:', email);
      res.status(200).json({ message: '로그인 성공', userid: user.userid });
    } else {
      console.log('비밀번호가 일치하지 않습니다:', email);
      res.status(401).json({ message: '비밀번호가 일치하지 않습니다.' });
    }
  } catch (error) {
    console.error('로그인 중 오류 발생:', error);
    res.status(500).json({ message: '로그인 중 오류가 발생했습니다.' });
  }
});

// 나만의 레시피
app.post('/createMyRecipe', upload.array('files', 3), async (req, res) => {
  try {
    const { title, description, instructions } = req.body;
    const files = req.files.map((file) => file.path);
    const ingredients = [];

    for (let i = 0; req.body[`ingredient_${i}_name`]; i++) {
      ingredients.push({
        name: req.body[`ingredient_${i}_name`],
        quantity: req.body[`ingredient_${i}_quantity`],
        unit: req.body[`ingredient_${i}_unit`],
      });
    }

    const myRecipe = new MyRecipe({
      title,
      description,
      files,
      ingredients,
      instructions,
    });

    await myRecipe.save();
    res.status(201).json(myRecipe);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
