# TRIX3D åç«¯ API ææ¡£

> çæ¬: 1.4.0
> **æåæ´æ?*: 2026-03-29ï¼åå®¹å·²å®¡éï¼ç²¾ç® TRIX Native Server APIï¼å®æ´ææ¡£è§ `../TRIX_NATIVE_CHANNEL.md`ï¼?

---

## ç®å½

1. [æ¦è¿°](#æ¦è¿°)
2. [åºç¡éç½®](#åºç¡éç½®)
3. [è®¤è¯](#è®¤è¯)
4. [API ç«¯ç¹åè¡¨](#api-ç«¯ç¹åè¡¨)
5. [TRIX Native Server API](#trix-native-server-api)
6. [ååºæ ¼å¼](#ååºæ ¼å¼)
7. [éè¯¯ç ](#éè¯¯ç ?
8. [æ°æ®åºè¡¨ç»æ](#æ°æ®åºè¡¨ç»æ)

---

## æ¦è¿°

æ?API ä¸?TRIX3D åºç¨æä¾åç«¯æå¡ï¼æ¯æç¨æ·ç®¡çãç¤¾äº¤ãå­¦ä¹ ãååç­åè½ã?

> â ï¸ **çæ¬è¯´æ (v1.3.1)**ï¼æ¬ææ¡£ç¬?4-21 èï¼ç¨æ·ãå¥½åãæ¥ç¨ãå¾åãæå°±ãååç­ï¼æè¿°çæ?**Supabase v2 ç®æ æ¶æ**ï¼ä¸ç«¯åä¸è®¡åï¼ï¼**~85% çç«¯ç¹å°æªå¨çäº§ä»£ç ä¸­å®ç?*ï¼æå¡å¨ `TrixNativeServer.ts` ä¸­ä¸å­å¨è¿äºè·¯ç±ï¼ã?
>
> **å½åçäº§ç¯å¢å¯ä¸æå¨ææ¡£**ï¼[`../TRIX_NATIVE_CHANNEL.md`](../TRIX_NATIVE_CHANNEL.md) â?TRIX Native Serverï¼ç«¯å?8788ï¼ï¼åå«éå¯¹ãæ¶æ¯ãStudy RoomãTTSãWebSocket ç­?*å·²å®ç?*çå¨é¨ç«¯ç¹ã?
>
> **â ï¸ ç¬?4-21 èä¸ºè§åææ¡£ï¼éçäº§ API è§èã?*

### æå¡ç«¯å£

| æå¡ | ç«¯å£ | æè¿° |
|------|------|------|
| Clawbot Channel | ~~8765~~ (å·²åºå¼? | AI å¯¹è¯æå¡ |
| TRIX Native Server | 8788 | iOS-Web æ¶æ¯åæ­¥ (å½åå¯ä¸) |

### 技术栈

- **运行时**: Node.js
- **框架**: Node.js 原生 http.createServer（无 Express）
- **数据库**: PostgreSQL (Supabase) + SQLite (本地)
- **实时通信**: WebSocket

---

## åºç¡éç½®

### åºç¡ URL

| ç¯å¢ | æå¡ | URL |
|------|------|-----|
| ~~å¼åç¯å¢~~ | ~~Clawbot Channel~~ | ~~å·²åºå¼~~ |
| ~~çäº§ç¯å¢~~ | ~~Clawbot Channel~~ | ~~å·²åºå¼~~ |
| å¼åç¯å¢?| TRIX Native | `http://TRIX_SERVER_HOST:8788/api` |
| çäº§ç¯å¢ | TRIX Native | `https://trix-native.trix3d.com/api` |

### è¯·æ±å¤?

```http
Content-Type: application/json
Authorization: Bearer <jwt_token>
```

---

## è®¤è¯

### è®¤è¯æ¹å¼

ææéè¦è®¤è¯ç API ç«¯ç¹é½å¿é¡»å¨è¯·æ±å¤´ä¸­æºå¸¦ JWT Tokenï¼?

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

Token éè¿ Supabase Auth è·åã?

### å¯éè®¤è¯?

é¨åç«¯ç¹æ¯æå¯éè®¤è¯ï¼å¸?Token è¿åç¨æ·ä¸å±æ°æ®ï¼ä¸å¸¦è¿åå¬å¼æ°æ®ï¼ï¼

- `GET /mall/items`
- `GET /places/nearby`
- `GET /places/search`

---

## API ç«¯ç¹åè¡¨

> â ï¸ **ä»¥ä¸ç¬?1-21 èåä¸ºè§åææ¡£ï¼æªå¨çäº§ä»£ç ä¸­å®ç°ï¼**

### 1. ç¨æ·æ¨¡å `/user` â ï¸ æªå®ç?

| æ¹æ³ | ç«¯ç¹ | è®¤è¯ | æè¿° |
|------|------|------|------|
| GET | `/user/profile` | â?| è·åç¨æ·èµæ |
| PUT | `/user/profile` | â?| æ´æ°ç¨æ·èµæ |
| POST | `/user/avatar` | â?| æ´æ°ç¨æ·å¤´å |
| GET | `/user/stats` | â?| è·åç¨æ·ç»è®¡ |
| GET | `/user/settings` | â?| è·åç¨æ·è®¾ç½® |
| PUT | `/user/settings` | â?| æ´æ°ç¨æ·è®¾ç½® |

#### è¯·æ±/ååºç¤ºä¾

**GET /user/profile**

```bash
curl -X GET http://TRIX_SERVER_HOST:8788/api/user/profile \
  -H "Authorization: Bearer <token>"
```

```json
{
  "success": true,
  "message": "æå",
  "data": {
    "id": "uuid",
    "username": "user123",
    "full_name": "å¼ ä¸",
    "bio": "ä½ å¥½",
    "avatar_url": "https://...",
    "points": 1000,
    "days_active": 30
  }
}
```

**PUT /user/profile**

```json
{
  "username": "newusername",
  "full_name": "æ°åå­?,
  "bio": "æ°ç®ä»?,
  "school": "æ¸åå¤§å­¦",
  "grade": "é«ä¸"
}
```

---

### 2. å¥½åæ¨¡å `/friends` â ï¸ æªå®ç?

| æ¹æ³ | ç«¯ç¹ | è®¤è¯ | æè¿° |
|------|------|------|------|
| GET | `/friends` | â?| è·åå¥½ååè¡¨ |
| POST | `/friends` | â?| æ·»å å¥½å |
| DELETE | `/friends/:id` | â?| å é¤å¥½å |
| GET | `/friends/requests` | â?| è·åå¥½åè¯·æ± |
| POST | `/friends/requests/:id/accept` | â?| æ¥åè¯·æ± |
| POST | `/friends/requests/:id/decline` | â?| æç»è¯·æ± |

---

### 3. æ¥ç¨æ¨¡å `/schedules` â ï¸ æªå®ç?

| æ¹æ³ | ç«¯ç¹ | è®¤è¯ | æè¿° |
|------|------|------|------|
| GET | `/schedules` | â?| è·åæ¥ç¨åè¡¨ |
| POST | `/schedules` | â?| åå»ºæ¥ç¨ |
| PUT | `/schedules/:id` | â?| æ´æ°æ¥ç¨ |
| DELETE | `/schedules/:id` | â?| å é¤æ¥ç¨ |
| GET | `/schedules/range?start=&end=` | â?| ææ¥æèå´æ¥è¯?|
| GET | `/schedules/upcoming?minutes=30` | â?| è·åå³å°å°æ¥çæ¥ç¨?|

---

### 4. å¾åæ¨¡å `/todos` â ï¸ æªå®ç?

| æ¹æ³ | ç«¯ç¹ | è®¤è¯ | æè¿° |
|------|------|------|------|
| GET | `/todos` | â?| è·åå¾ååè¡¨ |
| POST | `/todos` | â?| åå»ºå¾å |
| PUT | `/todos/:id` | â?| æ´æ°å¾å |
| DELETE | `/todos/:id` | â?| å é¤å¾å |
| POST | `/todos/:id/toggle` | â?| åæ¢å®æç¶æ?|

---

### 5. æå°±æ¨¡å `/achievements` â ï¸ æªå®ç?

| æ¹æ³ | ç«¯ç¹ | è®¤è¯ | æè¿° |
|------|------|------|------|
| GET | `/achievements` | â?| è·åæå°±åè¡¨ï¼å«è§£éç¶æï¼|
| POST | `/achievements/check` | â?| æ£æ¥å¹¶è§£éæå°± |
| POST | `/achievements/:id/unlock` | â?| æå¨è§£éæå°± |

---

### 6. ååæ¨¡å `/mall` â ï¸ æªå®ç?

| æ¹æ³ | ç«¯ç¹ | è®¤è¯ | æè¿° |
|------|------|------|------|
| GET | `/mall/items` | â?| è·ååååè¡¨ |
| GET | `/mall/items/:id` | â?| è·ååä¸ªåå |
| POST | `/mall/purchase` | â?| è´­ä¹°åå |
| GET | `/mall/purchase/history` | â?| è·åè´­ä¹°åå² |

---

### 7. è¡£ææ¨¡å `/wardrobe` â ï¸ æªå®ç?

| æ¹æ³ | ç«¯ç¹ | è®¤è¯ | æè¿° |
|------|------|------|------|
| GET | `/wardrobe/outfits` | â?| è·åè£æ®åè¡¨ |
| POST | `/wardrobe/outfits/:id/equip` | â?| è£å¤è£æ® |
| POST | `/wardrobe/outfits/:id/unequip` | â?| å¸ä¸è£æ® |

---

### 8. å­¦ä¹ åå²æ¨¡å `/study/history` â ï¸ æªå®ç?

| æ¹æ³ | ç«¯ç¹ | è®¤è¯ | æè¿° |
|------|------|------|------|
| GET | `/study/history/daily?days=7` | â?| æ¯æ¥å­¦ä¹ æ±æ?|
| GET | `/study/history/weekly` | â?| æ¯å¨å­¦ä¹ æ±æ?|
| GET | `/study/history/monthly` | â?| æ¯æå­¦ä¹ æ±æ?|

---

### 9. å­¦ä¹ è®°å½æ¨¡å `/study/sessions` â ï¸ æªå®ç?

| æ¹æ³ | ç«¯ç¹ | è®¤è¯ | æè¿° |
|------|------|------|------|
| GET | `/study/sessions` | â?| è·åå­¦ä¹ è®°å½ |
| POST | `/study/sessions` | â?| åå»ºå­¦ä¹ è®°å½ |
| PUT | `/study/sessions/:id` | â?| æ´æ°å­¦ä¹ è®°å½ |
| DELETE | `/study/sessions/:id` | â?| å é¤å­¦ä¹ è®°å½ |
| GET | `/study/stats` | â?| è·åå­¦ä¹ ç»è®¡ |
| GET | `/study/stats/weekly` | â?| è·åæ¯å¨å­¦ä¹ æ°æ® |

---

### 10. å­¦ä¹ æ¿é´æ¨¡å `/study/room` â ï¸ æªå®ç?

| æ¹æ³ | ç«¯ç¹ | è®¤è¯ | æè¿° |
|------|------|------|------|
| POST | `/study/room/create` | â?| åå»ºå­¦ä¹ æ¿é´ |
| POST | `/study/room/join` | â?| å å¥å­¦ä¹ æ¿é´ |
| POST | `/study/room/leave` | â?| ç¦»å¼å­¦ä¹ æ¿é´ |

---

### 11. èå¤©æ¨¡å `/chat` â ï¸ æªå®ç?

| æ¹æ³ | ç«¯ç¹ | è®¤è¯ | æè¿° |
|------|------|------|------|
| GET | `/chat/rooms` | â?| è·åèå¤©æ¿é´åè¡¨ |
| POST | `/chat/rooms` | â?| åå»ºèå¤©æ¿é´ |
| GET | `/chat/rooms/:roomId` | â?| è·åèå¤©æ¿é´è¯¦æ |
| GET | `/chat/rooms/:roomId/messages` | â?| è·åæ¶æ¯åè¡¨ |
| POST | `/chat/rooms/:roomId/messages` | â?| åéæ¶æ?|
| POST | `/chat/rooms/:roomId/messages/read` | â?| æ è®°å·²è¯» |

---

### 12. éå¯¹æ¨¡å `/pairing` â ï¸ æªå®ç?

| æ¹æ³ | ç«¯ç¹ | è®¤è¯ | æè¿° |
|------|------|------|------|
| POST | `/pairing/request` | â?| åå»ºéå¯¹è¯·æ± |
| POST | `/pairing/confirm` | â?| ç¡®è®¤éå¯¹ |
| GET | `/pairing/status/:id` | â?| æ¥è¯¢éå¯¹ç¶æ?|
| GET | `/pairing/devices` | â?| è·åå·²éå¯¹è®¾å¤?|
| DELETE | `/pairing/devices/:id` | â?| è§£é¤éå¯¹ |

---

### 13. å°ç¹æ¨¡å `/places` â ï¸ æªå®ç?

| æ¹æ³ | ç«¯ç¹ | è®¤è¯ | æè¿° |
|------|------|------|------|
| GET | `/places/nearby?latitude=&longitude=&radius=` | â?| è·åéè¿å°ç¹ |
| GET | `/places/search?q=&category=` | â?| æç´¢å°ç¹ |
| GET | `/places/favorites` | â?| è·åæ¶èå°ç¹ |
| POST | `/places/favorites` | â?| æ·»å æ¶è |
| DELETE | `/places/favorites/:id` | â?| å é¤æ¶è |
| POST | `/places/:placeId/favorite` | â?| åæ¢æ¶èç¶æ?|

---

### 14. ä½ç½®æ¨¡å `/locations` â ï¸ æªå®ç?

| æ¹æ³ | ç«¯ç¹ | è®¤è¯ | æè¿° |
|------|------|------|------|
| GET | `/locations` | â?| è·åä½ç½®åè¡¨ |
| GET | `/locations/:id` | â?| è·ååä¸ªä½ç½® |
| POST | `/locations/share` | â?| åäº«ä½ç½® |

---

### 15. ç§¯åæ¨¡å `/points` â ï¸ æªå®ç?

| æ¹æ³ | ç«¯ç¹ | è®¤è¯ | æè¿° |
|------|------|------|------|
| GET | `/points` | â?| è·åç¨æ·ç§¯å |
| GET | `/points/history` | â?| è·åç§¯ååå² |
| POST | `/points/add` | â?| å¢å ç§¯å |
| POST | `/points/deduct` | â?| æ£é¤ç§¯å |

---

### 16. å¿«ç§æ¨¡å `/snapshots` â ï¸ æªå®ç?

| æ¹æ³ | ç«¯ç¹ | è®¤è¯ | æè¿° |
|------|------|------|------|
| GET | `/snapshots` | â?| è·åå¿«ç§åè¡¨ |
| POST | `/snapshots` | â?| åå»ºå¿«ç§ |
| GET | `/snapshots/:id` | â?| è·ååä¸ªå¿«ç§ |
| DELETE | `/snapshots/:id` | â?| å é¤å¿«ç§ |

---

### 17. éç¥æ¨¡å `/notifications` â ï¸ æªå®ç?

| æ¹æ³ | ç«¯ç¹ | è®¤è¯ | æè¿° |
|------|------|------|------|
| GET | `/notifications` | â?| è·åéç¥åè¡¨ |
| PUT | `/notifications/:id/read` | â?| æ è®°å·²è¯» |
| POST | `/notifications/read-all` | â?| å¨é¨æ è®°å·²è¯» |
| POST | `/notifications/device-token` | â?| ä¿å­è®¾å¤ä»¤ç |
| GET | `/notifications/settings` | â?| è·åéç¥è®¾ç½® |
| PUT | `/notifications/settings` | â?| æ´æ°éç¥è®¾ç½® |
| GET | `/notifications/preferences` | â?| è·åéç¥åå¥½ |
| PUT | `/notifications/preferences` | â?| æ´æ°éç¥åå¥½ |

---

### 18. ä¸ä¼ æ¨¡å `/upload` â ï¸ æªå®ç?

| æ¹æ³ | ç«¯ç¹ | è®¤è¯ | æè¿° |
|------|------|------|------|
| POST | `/upload` | â?| æä»¶ä¸ä¼  |
| POST | `/upload/base64` | â?| Base64 ä¸ä¼  |

---

### 19. æªè¯»è®¡æ°æ¨¡å `/unread` â ï¸ æªå®ç?

| æ¹æ³ | ç«¯ç¹ | è®¤è¯ | æè¿° |
|------|------|------|------|
| GET | `/unread/counts` | â?| è·åæææªè¯»è®¡æ?|
| GET | `/unread/counts/:friendId` | â?| è·åä¸æå¥½åçæªè¯»è®¡æ?|
| PUT | `/unread/counts/:friendId` | â?| æ´æ°æªè¯»è®¡æ° |
| POST | `/unread/read-all` | â?| æ è®°å¨é¨å·²è¯» |

---

### 20. AI å¯¹è¯æ¨¡å `/clawbot` â ï¸ æªå®ç?

| æ¹æ³ | ç«¯ç¹ | è®¤è¯ | æè¿° |
|------|------|------|------|
| GET | `/clawbot/conversations` | â?| è·åå¯¹è¯åè¡¨ |
| POST | `/clawbot/conversations` | â?| åå»ºå¯¹è¯ |
| GET | `/clawbot/conversations/:id/messages` | â?| è·åå¯¹è¯æ¶æ¯ |
| POST | `/clawbot/conversations/:id/messages` | â?| åéæ¶æ?|
| DELETE | `/clawbot/conversations/:id` | â?| å é¤å¯¹è¯ |

---

### 21. å­¦ä¹ ç®æ æ¨¡å `/study/goals` â ï¸ æªå®ç?

| æ¹æ³ | ç«¯ç¹ | è®¤è¯ | æè¿° |
|------|------|------|------|
| GET | `/study/goals` | â?| è·åå­¦ä¹ ç®æ åè¡¨ |
| POST | `/study/goals` | â?| åå»ºå­¦ä¹ ç®æ  |
| PUT | `/study/goals/:id` | â?| æ´æ°å­¦ä¹ ç®æ  |
| DELETE | `/study/goals/:id` | â?| å é¤å­¦ä¹ ç®æ  |

---

## TRIX Native Server API

> â ï¸ **å®æ´ææ¡£å·²ç§»è?`../TRIX_NATIVE_CHANNEL.md`**ï¼å¯ä¸æå¨ææ¡£ï¼ã?
>
> ä»¥ä¸ä¸ºæè¦ï¼è¯¦ç»ä¿¡æ¯è¯·åéè¯¥ææ¡£ã?

### çäº§æå¡

| æå¡ | URL |
|------|-----|
| TRIX Native Server | `https://trix.love`ï¼ç«¯å?8788ï¼?|

### æ ¸å¿ç«¯ç¹

| æ¹æ³ | è·¯å¾ | è¯´æ |
|------|------|------|
| POST | `/api/pairings` | çæéå¯¹ç ?|
| GET | `/api/pairings/:code` | æ¥è¯¢éå¯¹ç¶æ?|
| POST | `/api/pairings/:code/claim` | è®¤é¢éå¯¹ |
| GET | `/health` | å¥åº·æ£æ¥ï¼å?agentOnlineï¼?|
| POST | `/api/messages` | åéæ¶æ¯ï¼clientToken å?body ä¸­ï¼ |
| POST | `/api/uploads` | ä¸ä¼ éä»¶ |
| GET | `/api/conversations/:id/messages` | åå²æ¶æ¯ |

### Study Room

| æ¹æ³ | è·¯å¾ | è¯´æ |
|------|------|------|
| POST | `/api/study-rooms` | åå»ºæ¿é´ |
| GET | `/api/study-rooms` | ååºæ¿é´ |
| POST | `/api/study-rooms/:roomCode/join` | å å¥ |
| POST | `/api/study-rooms/:roomCode/action` | ä¸»æäººæä½?|

### TTS

| æ¹æ³ | è·¯å¾ | è¯´æ |
|------|------|------|
| POST | `/api/tts/synthesize` | Edge TTS è¯­é³åæ |

### WebSocket

| è·¯å¾ | è§è² | è¯´æ |
|------|------|------|
| `/ws?role=user&...` | user | ç¨æ·å®æ¶æ¶æ¯ |
| `/api/service/ws` | service | Service/Plugin å®æ¶æ¶æ¯ |

### éå¯¹ç ?

- **æ ¼å¼**ï¼?-8 ä½å¤§åå­æ¯?
- **æææ?*ï¼? å°æ¶ï¼?0 åéï¼?
- **è½®è¯¢é´é**ï¼? ç§ï¼è¶æ¶ 5 åé

---

## ååºæ ¼å¼

### æåååº

```json
{
  "success": true,
  "message": "æå",
  "data": { ... }
}
```

### éè¯¯ååº

```json
{
  "success": false,
  "error": "éè¯¯ä¿¡æ¯"
}
```

---

## éè¯¯ç ?

| ç¶æç  | è¯´æ |
|--------|------|
| 200 | æå |
| 400 | è¯·æ±åæ°éè¯¯ |
| 401 | æªææ?/ Token æ æ |
| 403 | æéä¸è¶³ |
| 404 | èµæºä¸å­å?|
| 500 | æå¡å¨éè¯?|

---

## æ°æ®åºè¡¨ç»æ

### æ ¸å¿è¡?

```sql
-- ç¨æ·èµææ©å±
profiles (æ©å±å­æ®µ)
âââ points: ç§¯å
âââ days_active: æ´»è·å¤©æ°
âââ total_study_time: æ»å­¦ä¹ æ¶é?
âââ current_streak: å½åè¿ç»­å¤©æ°
âââ school: å­¦æ ¡
âââ grade: å¹´çº§
âââ avatar_config: å¤´åéç½®
âââ is_studying: æ¯å¦å¨å­¦ä¹?
```

### ç¤¾äº¤è¡?

```sql
friends -- å¥½åå³ç³»
friend_requests -- å¥½åè¯·æ±

chat_rooms -- èå¤©æ¿é´
chat_room_participants -- æ¿é´åä¸è?
chat_messages -- èå¤©æ¶æ¯
```

### åè½è¡?

```sql
schedules -- æ¥ç¨
todos -- å¾åäºé¡¹
achievements -- æå°±
user_achievements -- ç¨æ·æå°±
mall_items -- åååå
user_purchased_items -- å·²è´­åå
outfits -- è£æ®
user_outfits -- ç¨æ·è£æ®
user_points -- ç¨æ·ç§¯å
point_transactions -- ç§¯åè®°å½
purchase_history -- è´­ä¹°åå²
```

### å­¦ä¹ è¡?

```sql
study_sessions -- å­¦ä¹ è®°å½
study_stats -- å­¦ä¹ ç»è®¡
study_rooms -- å­¦ä¹ æ¿é´
study_room_participants -- æ¿é´åä¸è?
```

### ä½ç½®è¡?

```sql
places -- å°ç¹
user_favorite_places -- å°ç¹æ¶è
user_locations -- ç¨æ·ä½ç½®
```

### å¶ä»è¡?

```sql
pairing_requests -- éå¯¹è¯·æ±
paired_devices -- å·²éå¯¹è®¾å¤?
snapshots -- AI å¿«ç§
notifications -- éç¥
device_tokens -- è®¾å¤ä»¤ç
```

---

## å¸¸ç¨æ¥è¯¢åæ°

| åæ° | ç±»å | è¯´æ |
|------|------|------|
| `limit` | number | éå¶è¿åæ°é |
| `offset` | number | åç§»é?|
| `page` | number | é¡µç  |
| `days` | number | å¤©æ° |
| `minutes` | number | åéæ?|
| `latitude` | number | çº¬åº¦ |
| `longitude` | number | ç»åº¦ |
| `radius` | number | åå¾(ç±? |
| `start` | string | å¼å§æ¶é?|
| `end` | string | ç»ææ¶é´ |
| `category` | string | åç±» |
| `q` | string | æç´¢å³é®è¯?|
| `unread_only` | boolean | ä»æªè¯?|

---

## WebSocket äºä»¶ï¼TRIX Native Channelï¼?

### è¿æ¥

WebSocket è¿æ¥éè¿ TRIX Native Server (:8788) ä½¿ç¨åç WebSocket åè®®ï¼ä¸ä½¿ç¨ Socket.IOã?

```javascript
// ç¨æ·é?WebSocket è¿æ¥ï¼æ¥è?Web/iOSï¼?
const socket = new WebSocket('https://trix.love/ws?role=user&conversationId=...&clientId=...&clientToken=...');
```

### äºä»¶åè¡¨

| äºä»¶ | æ¹å | è¯´æ |
|------|------|------|
| `app_register` | å®¢æ·ç«?â?æå¡ç«?| æ³¨åç¨æ·è¿æ¥ |
| `bot_request_pairing` | å®¢æ·ç«?â?æå¡ç«?| æºå¨äººè¯·æ±éå¯?|
| `bot_confirm_pairing` | å®¢æ·ç«?â?æå¡ç«?| ç¡®è®¤éå¯¹ |
| `study_room_create` | å®¢æ·ç«?â?æå¡ç«?| åå»ºå­¦ä¹ æ¿é´ |
| `study_room_join` | å®¢æ·ç«?â?æå¡ç«?| å å¥å­¦ä¹ æ¿é´ |
| `study_room_leave` | å®¢æ·ç«?â?æå¡ç«?| ç¦»å¼å­¦ä¹ æ¿é´ |
| `message_sent` | æå¡ç«?â?å®¢æ·ç«?| æ¶æ¯åéæå?|
| `bot_message` | æå¡ç«?â?å®¢æ·ç«?| æºå¨äººæ¶æ?|

---

## æ´æ°æ¥å¿

### 2026-03-29

- æ´æ°çæ¬å·è³ 1.4.0
- åæ­¥æåæ´æ°æ¥æ?

### 2026-03-03

- åå§çæ¬
- å®ç°ææ?MVP + æ©å± API
- æ¯æç¨æ·ãå¥½åãæ¥ç¨ãå¾åãæå°±ãååãè¡£æãå­¦ä¹ ãèå¤©ãéå¯¹ãå°ç¹ãç§¯åãå¿«ç§ãéç¥ç­åè?
