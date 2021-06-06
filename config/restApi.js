import axios from 'axios';

export const AUTH_KEY = 'vJq6JCTXiBx5UNQpkT4fTex6ExBn.D0nePtkWBTjCQqBCiLu1oUAC';

export const STORE_KEY = '46324954765a68565643623654717049'; // 암호화 복호화 키

export const MID = 'ZP2007000098';

export const zeropayApi = axios.create({
  baseURL: 'https://zpg.dev-zeropaypoint.or.kr/',
  headers: {
    'Content-Type': 'application/json; charset=UTF-8',
    Authorization: `OnlineAK ${AUTH_KEY}`,
  },
});

export default zeropayApi;
