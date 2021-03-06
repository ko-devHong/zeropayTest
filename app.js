import express from 'express';
import zeroPayAPI, { STORE_KEY, MID } from './config/restApi';
import CryptoJS from 'crypto-js';
import moment from 'moment';
import querystring from 'querystring';
import session from 'express-session';

const FileStore = require('session-file-store')(session);

var app = express();

app.use(express.urlencoded({ extended: false, limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));
app.use(
  session({
    secret: 'keyboard cat', // μνΈν
    resave: false,
    saveUninitialized: true,
    store: new FileStore(),
  })
);
// GET method route
app.get('/', function (req, res) {
  res.send('GET request to the homepage!!');
});

// POST method route
app.post('/', function (req, res) {
  res.send('POST request to the homepage');
});

const EncryptHex = (string, chip, skey) => {
  let result = '';
  try {
    const key = CryptoJS.enc.Hex.parse(skey);
    if (chip === 'AES') {
      const iv = CryptoJS.lib.WordArray.create([0x00, 0x00, 0x00, 0x00]);
      result = CryptoJS.AES.encrypt(string, key, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
      });
      result = result.ciphertext.toString(CryptoJS.enc.Hex);
    } else {
      result = CryptoJS.HmacSHA256(string, key).toString(CryptoJS.enc.Hex);
    }
    return result;
  } catch (error) {
    throw error;
  }
};

const DecryptHex = (encryptedStringHex, chip, skey) => {
  let result = '';
  const key = CryptoJS.enc.Hex.parse(skey);
  const iv = CryptoJS.lib.WordArray.create([0x00, 0x00, 0x00, 0x00]);
  try {
    const array = CryptoJS.enc.Hex.parse(encryptedStringHex);
    if (chip === 'AES') {
      result = CryptoJS.AES.decrypt({ ciphertext: array }, key, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
      }).toString(CryptoJS.enc.Utf8);
    } else {
      result = array;
    }
    return result;
  } catch (error) {
    throw error;
  }
};

const verifyMac = (skey, res_ev, res_vv) => {
  const decryptedData = DecryptHex(res_ev, 'AES', skey);
  const checkHmac = EncryptHex(decryptedData, 'SHA', STORE_KEY);
  // console.log('$$$$');
  // console.log('decryptedData : ', decryptedData);
  // console.log('$$$$');
  // console.log('$$$$');
  // console.log('res_vv : ' + res_vv);
  // console.log('$$$$');
  // console.log('$$$$');
  // console.log('checkHmac : ' + checkHmac);
  // console.log('$$$$');
  if (res_vv === checkHmac) {
    return true;
  } else {
    return false;
  }
};
// λ³΅ν©κ²°μ  μ€λΉ
app.get('/zeropay/complex/ready', async (req, res) => {
  const params = {};
  const body = {};

  params.mid = MID; // κ°λ§Ήμ  μ½λ
  params.mode = 'development'; //κ°λ°νκ²½
  params.merchantOrderID = '20200723_order_id12341'; //κ°λ§Ήμ  μ£Όλ¬Έλ²νΈ
  params.merchantUserKey = 'test_mall_userkey'; // κ°λ§Ήμ  νμν€
  params.productName =
    '[λ₯λ₯νλ μ¬] λ₯λ₯μ΄ μ¬κ³Ό 5kg (κ³Όμν¬κΈ° λλ€λ°μ‘) ν¬ν¨ μ΄3κ±΄'; //μν νμλͺ
  params.totalAmount = 1500; // μνκΆ μ΄κΈμ‘
  params.approvalURL = `http://localhost:3000/zeropay/complex/result?type=success&totalAmount=${params.totalAmount}&merchantOrderID=${params.merchantOrderID}&merchantUserKey=${params.merchantUserKey}&productName=${params.productName}`;
  params.cancelURL = `http://localhost:3000/zeropay/complex/result?type=cancel&totalAmount=${params.totalAmount}`;
  params.failURL = `http://localhost:3000/zeropay/complex/result?type=fail`;
  params.apiCallYn = 'N'; // API νΈμΆμ¬λΆ(API,λ³΅ν©: Y, νλ©΄: N )
  params.payrCi = ''; // κ΅¬λ§€μ CI
  params.clphNo = ''; // κ΅¬λ§€μ νΈλν°λ²νΈ
  params.zip_no = '072'; // μνκΆ μ°νΈλ²νΈμ λ³΄

  try {
    const date = moment(new Date()).format('yyyyMMddkkmmss');
    const reqEV = EncryptHex(JSON.stringify(params), 'AES', STORE_KEY);
    const reqVV = EncryptHex(JSON.stringify(params), 'SHA', STORE_KEY);
    body.MID = MID;
    body.RQ_DTIME = date;
    body.TNO = date;
    body.EV = reqEV;
    body.VV = reqVV;
    body.RC = '';
    body.RM = '';

    const { data } = await zeroPayAPI.post(
      '/api_v1_payment_complex_reserve.jct',
      body
    );
    // return res.send(data);
    if (data.RC !== '0000') {
      return res.send('zeropay complex ready fail');
    } else {
      const resEV = data.EV;
      const resVV = data.VV;
      if (verifyMac(STORE_KEY, resEV, resVV)) {
        const decResult = JSON.parse(DecryptHex(resEV, 'AES', STORE_KEY));
        if (decResult.code === '000') {
          // return res.send(decResult.data);
          return res.redirect(decResult.data.redirectURLPC);
        } else {
          return res.send(
            'zeropay complex ready not 000 fail \n' + JSON.stringify(decResult)
          );
        }
      } else {
        return res.send('zeropay complex ready verify fail');
      }
    }
  } catch (error) {
    throw error;
  }
});

//λ³΅ν©κ²°μ μ€λΉ κ²°κ³Ό
app.get('/zeropay/complex/result', async (req, res) => {
  try {
    if (req.query.type === 'success') {
      // res.send('zeropay complex success');
      const resEV = req.query.EV;
      const resVV = req.query.VV;
      if (verifyMac(STORE_KEY, resEV, resVV)) {
        const decResult = JSON.parse(DecryptHex(resEV, 'AES', STORE_KEY));
        if (decResult.payReqList) {
          // return res.send(decResult);
          const query = querystring.stringify({
            totalAmount: req.query.totalAmount,
            merchantOrderID: req.query.merchantOrderID,
            merchantUserKey: req.query.merchantUserKey,
            productName: req.query.productName,
            payReqList: decResult.payReqList,
          });

          return res.redirect('/zeropay/ready?' + query);
        } else {
          return res.send(
            'zeropay ready not 000 fail \n' + JSON.stringify(decResult)
          );
        }
      } else {
        return res.send('zeropay ready verify fail');
      }
    } else {
      res.send('zeropay complex fail');
    }
  } catch (error) {
    throw error;
  }
});

//κ²°μ  μ€λΉ (νλ©΄μ°λ)
app.get('/zeropay/ready', async (req, res) => {
  const params = {};
  const productItems = [];
  const productItem = {};
  const productItem2 = {};
  const body = {};
  productItem.seq = 1;
  productItem.name = '[μ€λνλ μ¬] λͺ»λμ΄(ν κ³Ό) μ¬κ³Ό 5kg (κ³Όμν¬κΈ° λλ€λ°μ‘)';
  productItem.category = 'F';
  productItem.count = 2;
  productItem.amount = 1000;
  productItem.biz_no = '123456790';
  productItems.push(productItem);
  productItem2.seq = 2;
  productItem2.name = 'μ€μνΌν©κ³ΌμΌμ λ¬ΌμΈνΈ5νΈ(μ¬κ³Ό4κ³Ό/λ°°1κ³Ό)';
  productItem2.category = 'F';
  productItem2.count = 1;
  productItem2.amount = 500;
  productItem2.biz_no = '123456790';
  productItems.push(productItem2);

  params.mid = MID; // κ°λ§Ήμ  μ½λ
  params.mode = 'development'; //κ°λ°νκ²½
  params.merchantOrderID =
    req.query.merchantOrderID || '20200723_order_id12343'; //κ°λ§Ήμ  μ£Όλ¬Έλ²νΈ
  params.merchantUserKey = req.query.merchantUserKey || 'test_mall_userkey'; // κ°λ§Ήμ  νμν€
  params.productName =
    req.query.productName ||
    '[μ€λνλ μ¬] λͺ»λμ΄(ν κ³Ό) μ¬κ³Ό 5kg (κ³Όμν¬κΈ° λλ€λ°μ‘) ν¬ν¨ μ΄2κ±΄'; //μν νμλͺ
  params.quantity = 3; // μν μ΄μλ
  params.totalAmount = req.query.totalAmount || 1500; // μνκΆ μ΄κΈμ‘
  params.taxFreeAmount = 0; // μνλΉκ³ΌμΈκΈμ‘
  params.vatAmount = 137; // μν λΆκ°μΈ κΈμ‘
  params.approvalURL = `http://localhost:3000/zeropay/result?type=success&totalAmount=${params.totalAmount}`; // κ²°μ μΉμΈ μ±κ³΅μ return url
  params.cancelURL = `http://localhost:3000/zeropay/result?type=cancel&totalAmount=${params.totalAmount}`;
  params.failURL = `http://localhost:3000/zeropay/result?type=fail&totalAmount=${params.totalAmount}`;
  params.apiCallYn = 'N'; // API νΈμΆμ¬λΆ(API,λ³΅ν©: Y, νλ©΄: N )
  params.payrCi = '';
  params.clphNo = '';
  params.zip_no = '072';
  params.productItems = productItems;
  if (req.query.payReqList) {
    params.payReqList = req.query.payReqList;
  }

  try {
    const date = moment(new Date()).format('yyyyMMddkkmmss');
    const reqEV = EncryptHex(JSON.stringify(params), 'AES', STORE_KEY);
    const reqVV = EncryptHex(JSON.stringify(params), 'SHA', STORE_KEY);
    body.MID = MID;
    body.RQ_DTIME = date;
    body.TNO = date;
    body.EV = reqEV;
    body.VV = reqVV;
    body.RC = '';
    body.RM = '';

    // κ²°μ  μ€λΉ
    const { data } = await zeroPayAPI.post('/api_v1_payment_reserve.jct', body);
    // return res.send(data);
    if (data.RC !== '0000') {
      return res.send('zeropay ready fail');
    } else {
      const resEV = data.EV;
      const resVV = data.VV;
      if (verifyMac(STORE_KEY, resEV, resVV)) {
        const decResult = JSON.parse(DecryptHex(resEV, 'AES', STORE_KEY));
        if (decResult.code === '000') {
          req.session.tid = decResult.data.tid;
          return res.redirect(decResult.data.redirectURLPC);
        } else {
          return res.send(
            'zeropay ready not 000 fail \n' + JSON.stringify(decResult)
          );
        }
      } else {
        return res.send('zeropay ready verify fail');
      }
    }
  } catch (error) {
    throw error;
  }
});

// κ²°μ  μΉμΈ
const zeroPayAgreement = async (params) => {
  try {
    if (params) {
      const body = {};
      const request = {};
      request.mid = params.MID; // κ°λ§Ήμ  μ½λ
      request.tid = params.tid;
      // body.merchantOrderID = params.merchantOrderID;  //κ°λ§Ήμ  μ£Όλ¬Έλ²νΈ
      // body.merchantUserKey = params.merchantUserKey; //κ°λ§Ήμ  νμν€
      request.token = params.token;
      request.payload = '';
      request.totalAmount = params.totalAmount;

      const date = moment(new Date()).format('yyyyMMddkkmmss');
      const reqEV = EncryptHex(JSON.stringify(request), 'AES', STORE_KEY);
      const reqVV = EncryptHex(JSON.stringify(request), 'SHA', STORE_KEY);
      body.MID = MID;
      body.RQ_DTIME = date;
      body.TNO = date;
      body.EV = reqEV;
      body.VV = reqVV;
      body.RC = '';
      body.RM = '';

      const { data } = await zeroPayAPI.post(
        '/api_v1_payment_approval.jct',
        body
      );
      return data;
    } else {
      return null;
    }
  } catch (error) {
    throw error;
  }
};

// κ²°μ  κ²°κ³Ό
app.get('/zeropay/result', async (req, res) => {
  if (req.query.type === 'success') {
    // res.send('zeropay success');
    if (req.query.RC !== '0000') {
      return res.send('zeropay ready fail');
    } else {
      const resEV = req.query.EV;
      const resVV = req.query.VV;
      if (verifyMac(STORE_KEY, resEV, resVV)) {
        const decResult = JSON.parse(DecryptHex(resEV, 'AES', STORE_KEY));
        if (decResult) {
          decResult.MID = req.query.MID;
          decResult.totalAmount = req.query.totalAmount;
          decResult.tid = req.session.tid;
          req.session.tid = null; // μ΄κΈ°ν
          const paymentResult = await zeroPayAgreement(decResult);
          if (paymentResult.RC !== '0000') {
            return res.send('zeropay result fail');
          } else {
            const resEV = paymentResult.EV;
            const resVV = paymentResult.VV;
            if (verifyMac(STORE_KEY, resEV, resVV)) {
              const decResult = JSON.parse(DecryptHex(resEV, 'AES', STORE_KEY));
              if (decResult.code === '000') {
                return res.send(decResult);
              } else {
                return res.send(
                  'zeropay result not 000 fail\n' + JSON.stringify(decResult)
                );
              }
            } else {
              return res.send('zeropay result verify fail');
            }
          }
        } else {
          return res.send(
            'zeropay ready not 000 fail \n' + JSON.stringify(decResult)
          );
        }
      } else {
        return res.send('zeropay ready verify fail');
      }
    }
  } else {
    res.send('zeropay  fail');
  }
});

// κ²°μ  μ·¨μ
app.get('/zeropay/cancel', async function (req, res) {
  const body = {};
  const params = {};
  const mid = req.query.mid || MID;
  const tid = req.query.tid || '200731ZP00010682';
  const cancelAmount = req.query.cancelAmount || 1500;
  const cancelTaxFreeAmount = req.query.cancelTaxFreeAmount || 0;
  params.mid = mid;
  params.tid = tid;
  params.cancelAmount = cancelAmount;
  params.cancelTaxFreeAmount = cancelTaxFreeAmount;

  const date = moment(new Date()).format('yyyyMMddkkmmss');
  const reqEV = EncryptHex(JSON.stringify(params), 'AES', STORE_KEY);
  const reqVV = EncryptHex(JSON.stringify(params), 'SHA', STORE_KEY);
  body.MID = MID;
  body.RQ_DTIME = date;
  body.TNO = date;
  body.EV = reqEV;
  body.VV = reqVV;
  body.RC = '';
  body.RM = '';

  try {
    const { data } = await zeroPayAPI.post('/api_v1_payment_cancel.jct', body);
    // return res.send(data);
    if (data.RC !== '0000') {
      return res.send('zeropay cancel fail');
    } else {
      const resEV = data.EV;
      const resVV = data.VV;
      if (verifyMac(STORE_KEY, resEV, resVV)) {
        const decResult = JSON.parse(DecryptHex(resEV, 'AES', STORE_KEY));
        console.log('$$$$$$$$$$');
        console.log(decResult);
        console.log('$$$$$$$$$$');
        if (decResult.code === '000') {
          return res.send(decResult);
        } else {
          return res.send(
            'zeropay cancel not 000 fail\n' + JSON.stringify(decResult)
          );
        }
      } else {
        return res.send('zeropay cancel verify fail');
      }
    }
  } catch (error) {
    throw error;
  }
});

// κ²°μ  μν μ‘°ν
app.get('/zeropay/status/search', async function (req, res) {
  const body = {};
  const params = {};
  const mid = req.query.mid || MID;
  const tid = req.query.tid || '200731ZP00010682';
  params.mid = mid;
  params.tid = tid;

  const date = moment(new Date()).format('yyyyMMddkkmmss');
  const reqEV = EncryptHex(JSON.stringify(params), 'AES', STORE_KEY);
  const reqVV = EncryptHex(JSON.stringify(params), 'SHA', STORE_KEY);
  body.MID = MID;
  body.RQ_DTIME = date;
  body.TNO = date;
  body.EV = reqEV;
  body.VV = reqVV;
  body.RC = '';
  body.RM = '';
  try {
    const { data } = await zeroPayAPI.post('/api_v1_payment_status.jct', body);
    // return res.send(data);
    if (data.RC !== '0000') {
      return res.send('zeropay ready fail');
    } else {
      const resEV = data.EV;
      const resVV = data.VV;
      if (verifyMac(STORE_KEY, resEV, resVV)) {
        const decResult = JSON.parse(DecryptHex(resEV, 'AES', STORE_KEY));
        console.log('$$$$$$$$$$');
        console.log(decResult);
        console.log('$$$$$$$$$$');
        if (decResult.code === '000') {
          return res.send(decResult);
        } else {
          return res.send(
            'zeropay ready not 000 fail\n' + JSON.stringify(decResult)
          );
        }
      } else {
        return res.send('zeropay ready verify fail');
      }
    }
  } catch (error) {
    throw error;
  }
});

// μ μ°λ΄μ­ μ‘°ν
app.get('/zeropay/payment/search', async function (req, res) {
  const params = {};
  const body = {};
  const mid = req.query.mid || MID;
  const fromDate = req.query.fromDate || '20200729'; //μ‘°ν μμμΌμ
  const toDate = req.query.toDate || '20200801'; //μ‘°ν μ’λ£μΌμ
  const perPage = req.query.perPage || 10; // νμ΄μ§λΉ κ±΄μ
  const pageIndex = req.query.pageIndex || 1; //μμ νμ΄μ§
  params.mid = mid;
  params.fromDate = fromDate;
  params.toDate = toDate;
  params.perPage = perPage;
  params.pageIndex = pageIndex;

  const date = moment(new Date()).format('yyyyMMddkkmmss');
  const reqEV = EncryptHex(JSON.stringify(params), 'AES', STORE_KEY);
  const reqVV = EncryptHex(JSON.stringify(params), 'SHA', STORE_KEY);
  body.MID = MID;
  body.RQ_DTIME = date;
  body.TNO = date;
  body.EV = reqEV;
  body.VV = reqVV;
  body.RC = '';
  body.RM = '';
  try {
    const { data } = await zeroPayAPI.post('/api_v1_payment_sttlinq.jct', body);
    // return res.send(data);
    if (data.RC !== '0000') {
      return res.send('zeropay ready fail');
    } else {
      const resEV = data.EV;
      const resVV = data.VV;
      if (verifyMac(STORE_KEY, resEV, resVV)) {
        const decResult = JSON.parse(DecryptHex(resEV, 'AES', STORE_KEY));
        console.log('$$$$$$$$$$');
        console.log(decResult);
        console.log('$$$$$$$$$$');
        if (decResult.code === '000') {
          return res.send(decResult);
        } else {
          return res.send(
            'zeropay ready not 000 fail\n' + JSON.stringify(decResult)
          );
        }
      } else {
        return res.send('zeropay ready verify fail');
      }
    }
  } catch (error) {
    throw error;
  }
});

app.listen(3000, function () {
  console.log('Example app listening on port 3000!');
});
