import { Express, Request, Response, NextFunction } from "express";
import { db, legacyDb, isDatabaseAvailable, isLegacyDbAvailable, switchToFallback } from "./db";

function is402(err: unknown): boolean {
  const msg = (err as any)?.message ?? '';
  return msg.includes('402') || msg.includes('data transfer quota') || msg.includes('exceeded');
}
import { users, registerUserSchema, loginUserSchema } from "../shared/schema";
import { eq, or } from "drizzle-orm";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import { jsonStorage } from "./jsonStorage";
import { emitSync } from './dbSync';
import crypto from "crypto";

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
export const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');

export const ADMIN_FALLBACK = {
  id: -1,
  email: "lucaforte94@gmail.com",
  username: "LucaForte",
  avatar: "crown",
  puntiRankiard: 999999,
  isAdmin: true
};

interface JWTPayload {
  userId: number;
  email: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

function generateToken(userId: number, email: string | null): string {
  return jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: "7d" });
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token mancante" });
  }
  
  const token = authHeader.split(" ")[1];
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Token non valido o scaduto" });
  }
}

const VALID_AVATAR_IDS = [
  'dragon', 'lion', 'wolf', 'eagle', 'shark', 'tiger', 'bear', 'fox',
  'owl', 'snake', 'unicorn', 'phoenix', 'wizard', 'knight', 'ninja',
  'robot', 'alien', 'skull', 'crown', 'star', 'fire', 'lightning',
  'diamond', 'heart'
];

export function registerAuthRoutes(app: Express) {
  app.get("/api/auth/config", (_req: Request, res: Response) => {
    res.json({
      googleClientId: process.env.GOOGLE_CLIENT_ID || null,
    });
  });

  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const validation = registerUserSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          error: "Dati non validi", 
          details: validation.error.errors 
        });
      }

      const { username, email, password, avatar } = validation.data;

      if (isDatabaseAvailable() && db) {
        const existingUser = await db.select().from(users).where(
          or(eq(users.email, email), eq(users.username, username))
        ).limit(1);

        if (existingUser.length > 0) {
          const existing = existingUser[0];
          if (existing.email === email) {
            return res.status(400).json({ error: "Email già registrata" });
          }
          if (existing.username === username) {
            return res.status(400).json({ error: "Nome utente già in uso" });
          }
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const validAvatar = avatar && VALID_AVATAR_IDS.includes(avatar) ? avatar : 'dragon';

        try {
          const [newUser] = await db.insert(users).values({
            username,
            email,
            password: hashedPassword,
            avatar: validAvatar,
          }).returning();

          emitSync('users', 'insert', { username, email, password: hashedPassword, avatar: validAvatar });

          const token = generateToken(newUser.id, newUser.email);

          return res.json({
            success: true,
            token,
            user: {
              id: newUser.id,
              username: newUser.username,
              email: newUser.email,
              avatar: newUser.avatar,
              puntiRankiard: newUser.puntiRankiard,
            }
          });
        } catch (insertError) {
          console.error("DB Insert error, falling back to JSON:", insertError);
          // Fall through to JSON storage if DB insert fails
        }
      }

      const existingByEmail = jsonStorage.users.getByEmail(email);
      if (existingByEmail) {
        return res.status(400).json({ error: "Email già registrata" });
      }
      const existingByUsername = jsonStorage.users.getByUsername(username);
      if (existingByUsername) {
        return res.status(400).json({ error: "Nome utente già in uso" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const validAvatar = avatar && VALID_AVATAR_IDS.includes(avatar) ? avatar : 'dragon';

      const newUser = jsonStorage.users.create({
        username,
        email,
        password: hashedPassword,
        googleId: null,
        avatar: validAvatar,
        puntiRankiard: 0,
        isAdmin: false,
        resetPasswordToken: null,
        resetPasswordExpires: null,
      });

      emitSync('users', 'insert', { username, email, password: hashedPassword, googleId: null, avatar: validAvatar, puntiRankiard: 0, isAdmin: false });

      const token = generateToken(newUser.id, newUser.email);

      res.json({
        success: true,
        token,
        user: {
          id: newUser.id,
          username: newUser.username,
          email: newUser.email,
          avatar: newUser.avatar,
          puntiRankiard: newUser.puntiRankiard,
        }
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ error: "Errore durante la registrazione" });
    }
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const validation = loginUserSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          error: "Dati non validi", 
          details: validation.error.errors 
        });
      }

      const { email, password } = validation.data;

      if (isDatabaseAvailable() && db) {
        try {
          let [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

          if (!user) {
            // Check legacy DB (old Replit Neon DB) for migration
            if (isLegacyDbAvailable() && legacyDb) {
              try {
                const [legacyUser] = await legacyDb.select().from(users).where(eq(users.email, email)).limit(1);
                if (legacyUser && legacyUser.password) {
                  const validLegacyPassword = await bcrypt.compare(password, legacyUser.password);
                  if (validLegacyPassword) {
                    console.log(`[Migration] Migrating user ${email} from legacy DB to external DB`);
                    try {
                      [user] = await db.insert(users).values({
                        username: legacyUser.username,
                        email: legacyUser.email,
                        password: legacyUser.password,
                        googleId: legacyUser.googleId,
                        avatar: legacyUser.avatar,
                        puntiRankiard: legacyUser.puntiRankiard,
                        gamesPlayed: legacyUser.gamesPlayed,
                        gamesWon: legacyUser.gamesWon,
                        minutesPlayed: legacyUser.minutesPlayed,
                        tutorialCompleted: legacyUser.tutorialCompleted,
                        isAdmin: legacyUser.isAdmin,
                      }).returning();
                      console.log(`[Migration] ✅ User ${email} migrated successfully`);
                    } catch (migrationError) {
                      console.error("[Migration] Error migrating user from legacy DB:", migrationError);
                      // Still allow login using legacy user data
                      const token = generateToken(legacyUser.id, legacyUser.email);
                      return res.json({
                        success: true,
                        token,
                        user: {
                          id: legacyUser.id,
                          username: legacyUser.username,
                          email: legacyUser.email,
                          avatar: legacyUser.avatar,
                          puntiRankiard: legacyUser.puntiRankiard,
                        }
                      });
                    }
                  }
                }
              } catch (legacyErr) {
                console.warn("[Migration] Could not query legacy DB:", legacyErr);
              }
            }

            // Fallback: check JSON storage
            if (!user) {
              const jsonUser = jsonStorage.users.getByEmail(email);
              if (jsonUser && jsonUser.password) {
                const validJsonPassword = await bcrypt.compare(password, jsonUser.password);
                if (validJsonPassword) {
                  console.log(`[Migration] Migrating user ${email} from JSON to external DB`);
                  try {
                    [user] = await db.insert(users).values({
                      username: jsonUser.username,
                      email: jsonUser.email,
                      password: jsonUser.password,
                      avatar: jsonUser.avatar,
                      puntiRankiard: jsonUser.puntiRankiard,
                      gamesPlayed: 0,
                      gamesWon: 0,
                      tutorialCompleted: false,
                      isAdmin: jsonUser.isAdmin,
                    }).returning();
                    console.log(`[Migration] ✅ User ${email} migrated from JSON successfully`);
                  } catch (migrationError) {
                    console.error("[Migration] Error migrating user from JSON:", migrationError);
                    const token = generateToken(jsonUser.id, jsonUser.email);
                    return res.json({
                      success: true,
                      token,
                      user: {
                        id: jsonUser.id,
                        username: jsonUser.username,
                        email: jsonUser.email,
                        avatar: jsonUser.avatar,
                        puntiRankiard: jsonUser.puntiRankiard,
                      }
                    });
                  }
                }
              }
            }
          }

          if (!user) {
            return res.status(401).json({ error: "Email o password non corretti" });
          }

          if (!user.password) {
            return res.status(401).json({ error: "Questo account usa Google per accedere" });
          }

          const validPassword = await bcrypt.compare(password, user.password);
          if (!validPassword) {
            return res.status(401).json({ error: "Email o password non corretti" });
          }

          // Check if user is banned
          if (user.bannedUntil && new Date(user.bannedUntil) > new Date()) {
            const bannedUntil = new Date(user.bannedUntil);
            const reason = user.banReason || 'Nessuna motivazione specificata';
            const formattedDate = bannedUntil.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            return res.status(403).json({ 
              error: `Account sospeso fino al ${formattedDate}. Motivo: ${reason}` 
            });
          }

          const token = generateToken(user.id, user.email);

          res.json({
            success: true,
            token,
            user: {
              id: user.id,
              username: user.username,
              email: user.email,
              avatar: user.avatar,
              puntiRankiard: user.puntiRankiard,
            }
          });
        } catch (dbError) {
          console.error("Database error during login, trying fallback:", dbError);

          // ── Auto-retry with fallback DB on 402 quota exceeded ───────────────
          if (is402(dbError)) {
            const switched = switchToFallback();
            if (switched) {
              try {
                let [retryUser] = await db.select().from(users).where(eq(users.email, email)).limit(1);
                if (retryUser) {
                  if (!retryUser.password) {
                    return res.status(401).json({ error: "Questo account usa Google per accedere" });
                  }
                  const validPwd = await bcrypt.compare(password, retryUser.password);
                  if (!validPwd) return res.status(401).json({ error: "Email o password non corretti" });
                  const token = generateToken(retryUser.id, retryUser.email);
                  return res.json({
                    success: true, token,
                    user: { id: retryUser.id, username: retryUser.username, email: retryUser.email, avatar: retryUser.avatar, puntiRankiard: retryUser.puntiRankiard }
                  });
                }
                // User not found in fallback DB — fall through to ADMIN_FALLBACK / 503
              } catch (retryErr) {
                console.error("Login retry with fallback DB also failed:", retryErr);
              }
            }
          }

          if (email === ADMIN_FALLBACK.email && process.env.ADMIN_FALLBACK_PASSWORD) {
            if (password === process.env.ADMIN_FALLBACK_PASSWORD) {
              const token = generateToken(ADMIN_FALLBACK.id, ADMIN_FALLBACK.email);
              
              return res.json({
                success: true,
                token,
                user: {
                  id: ADMIN_FALLBACK.id,
                  username: ADMIN_FALLBACK.username,
                  email: ADMIN_FALLBACK.email,
                  avatar: ADMIN_FALLBACK.avatar,
                  puntiRankiard: ADMIN_FALLBACK.puntiRankiard,
                },
                fallbackMode: true
              });
            }
          }
          
          return res.status(503).json({ error: "Database non disponibile. Solo l'admin può accedere." });
        }
      } else {
        if (email === ADMIN_FALLBACK.email && process.env.ADMIN_FALLBACK_PASSWORD) {
          if (password === process.env.ADMIN_FALLBACK_PASSWORD) {
            const token = generateToken(ADMIN_FALLBACK.id, ADMIN_FALLBACK.email);
            
            return res.json({
              success: true,
              token,
              user: {
                id: ADMIN_FALLBACK.id,
                username: ADMIN_FALLBACK.username,
                email: ADMIN_FALLBACK.email,
                avatar: ADMIN_FALLBACK.avatar,
                puntiRankiard: ADMIN_FALLBACK.puntiRankiard,
              },
              fallbackMode: true
            });
          }
        }

        const user = jsonStorage.users.getByEmail(email);

        if (!user) {
          return res.status(401).json({ error: "Email o password non corretti" });
        }

        if (!user.password) {
          return res.status(401).json({ error: "Questo account usa Google per accedere" });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
          return res.status(401).json({ error: "Email o password non corretti" });
        }

        const token = generateToken(user.id, user.email);

        res.json({
          success: true,
          token,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            avatar: user.avatar,
            puntiRankiard: user.puntiRankiard,
          }
        });
      }
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Errore durante il login" });
    }
  });

  app.post("/api/auth/google", async (req: Request, res: Response) => {
    try {
      const { credential, avatar } = req.body;

      if (!credential) {
        return res.status(400).json({ error: "Token Google mancante" });
      }

      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      if (!payload) {
        return res.status(401).json({ error: "Token Google non valido" });
      }

      const googleId = payload.sub;
      const email = payload.email;
      const name = payload.name || email?.split("@")[0] || "Giocatore";

      if (isDatabaseAvailable() && db) {
        let [user] = await db.select().from(users).where(eq(users.googleId, googleId)).limit(1);

        if (!user && email) {
          const [existingEmailUser] = await db.select().from(users).where(eq(users.email, email)).limit(1);
          
          if (existingEmailUser) {
            [user] = await db.update(users)
              .set({ googleId })
              .where(eq(users.id, existingEmailUser.id))
              .returning();
            emitSync('users', 'update', { googleId, _syncId: existingEmailUser.id }, eq(users.id, existingEmailUser.id));
          }
        }

        // Migration check for Google Auth — legacy DB first, then JSON
        if (!user) {
          if (isLegacyDbAvailable() && legacyDb) {
            try {
              let [legacyUser] = await legacyDb.select().from(users).where(eq(users.googleId, googleId)).limit(1);
              if (!legacyUser && email) {
                const [legacyByEmail] = await legacyDb.select().from(users).where(eq(users.email, email)).limit(1);
                if (legacyByEmail) legacyUser = legacyByEmail;
              }
              if (legacyUser) {
                console.log(`[Migration] Migrating Google user ${email || googleId} from legacy DB to external DB`);
                try {
                  [user] = await db.insert(users).values({
                    username: legacyUser.username,
                    email: legacyUser.email,
                    googleId: googleId,
                    avatar: legacyUser.avatar,
                    puntiRankiard: legacyUser.puntiRankiard,
                    gamesPlayed: legacyUser.gamesPlayed,
                    gamesWon: legacyUser.gamesWon,
                    minutesPlayed: legacyUser.minutesPlayed,
                    tutorialCompleted: legacyUser.tutorialCompleted,
                    isAdmin: legacyUser.isAdmin,
                  }).returning();
                  console.log(`[Migration] ✅ Google user ${email || googleId} migrated successfully`);
                } catch (migrationError) {
                  console.error("[Migration] Error migrating Google user from legacy DB:", migrationError);
                }
              }
            } catch (legacyErr) {
              console.warn("[Migration] Could not query legacy DB for Google user:", legacyErr);
            }
          }

          // Fallback: JSON storage
          if (!user) {
            const jsonUser = jsonStorage.users.getByGoogleId(googleId) || (email ? jsonStorage.users.getByEmail(email) : undefined);
            if (jsonUser) {
              console.log(`[Migration] Migrating Google user ${email || googleId} from JSON to external DB`);
              try {
                [user] = await db.insert(users).values({
                  username: jsonUser.username,
                  email: jsonUser.email,
                  googleId: googleId,
                  avatar: jsonUser.avatar,
                  puntiRankiard: jsonUser.puntiRankiard,
                  isAdmin: jsonUser.isAdmin,
                }).returning();
                emitSync('users', 'insert', { ...jsonUser, googleId });
              } catch (migrationError) {
                console.error("[Migration] Error migrating Google user from JSON:", migrationError);
              }
            }
          }
        }

        if (!user) {
          let username = name.replace(/\s+/g, "_").substring(0, 20);
          const [existingUsername] = await db.select().from(users).where(eq(users.username, username)).limit(1);
          if (existingUsername) {
            username = `${username}_${Date.now().toString(36)}`.substring(0, 20);
          }

          const validAvatar = avatar && VALID_AVATAR_IDS.includes(avatar) ? avatar : 'dragon';

          [user] = await db.insert(users).values({
            username,
            email: email || undefined,
            googleId,
            avatar: validAvatar,
          }).returning();
          emitSync('users', 'insert', { username, email: email || undefined, googleId, avatar: validAvatar });
        }

        const token = generateToken(user.id, user.email);

        res.json({
          success: true,
          token,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            avatar: user.avatar,
            puntiRankiard: user.puntiRankiard,
          }
        });
      } else {
        let user = jsonStorage.users.getByGoogleId(googleId);

        if (!user && email) {
          const existingEmailUser = jsonStorage.users.getByEmail(email);
          if (existingEmailUser) {
            user = jsonStorage.users.update(existingEmailUser.id, { googleId }) || undefined;
            emitSync('users', 'update', { googleId, _syncId: existingEmailUser.id }, eq(users.id, existingEmailUser.id));
          }
        }

        if (!user) {
          let username = name.replace(/\s+/g, "_").substring(0, 20);
          const existingUsername = jsonStorage.users.getByUsername(username);
          if (existingUsername) {
            username = `${username}_${Date.now().toString(36)}`.substring(0, 20);
          }

          const validAvatar = avatar && VALID_AVATAR_IDS.includes(avatar) ? avatar : 'dragon';

          user = jsonStorage.users.create({
            username,
            email: email || null,
            password: null,
            googleId,
            avatar: validAvatar,
            puntiRankiard: 0,
            isAdmin: false,
            resetPasswordToken: null,
            resetPasswordExpires: null,
          });
          emitSync('users', 'insert', { username, email: email || null, password: null, googleId, avatar: validAvatar, puntiRankiard: 0, isAdmin: false });
        }

        const token = generateToken(user.id, user.email);

        res.json({
          success: true,
          token,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            avatar: user.avatar,
            puntiRankiard: user.puntiRankiard,
          }
        });
      }
    } catch (error) {
      console.error("Google auth error:", error);
      res.status(500).json({ error: "Errore durante l'autenticazione con Google" });
    }
  });

  app.get("/api/auth/user/:userId", authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.userId);
      if (isNaN(userId)) {
        return res.status(400).json({ error: "ID utente non valido" });
      }

      if (req.user?.userId !== userId) {
        return res.status(403).json({ error: "Accesso non autorizzato" });
      }

      if (isDatabaseAvailable() && db) {
        const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

        if (!user) {
          return res.status(404).json({ error: "Utente non trovato" });
        }

        res.json({
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            avatar: user.avatar,
            puntiRankiard: user.puntiRankiard,
          }
        });
      } else {
        if (userId === ADMIN_FALLBACK.id) {
          return res.json({
            user: {
              id: ADMIN_FALLBACK.id,
              username: ADMIN_FALLBACK.username,
              email: ADMIN_FALLBACK.email,
              avatar: ADMIN_FALLBACK.avatar,
              puntiRankiard: ADMIN_FALLBACK.puntiRankiard,
            }
          });
        }

        const user = jsonStorage.users.getById(userId);

        if (!user) {
          return res.status(404).json({ error: "Utente non trovato" });
        }

        res.json({
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            avatar: user.avatar,
            puntiRankiard: user.puntiRankiard,
          }
        });
      }
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ error: "Errore nel recupero utente" });
    }
  });

  app.get("/api/auth/me", async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.json({ user: null, guestMode: true, noToken: true });
      }
      
      const token = authHeader.split(" ")[1];
      let decoded: JWTPayload;
      
      try {
        decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
      } catch (tokenError) {
        return res.status(401).json({ error: "Token non valido o scaduto" });
      }

      if (decoded.userId === ADMIN_FALLBACK.id && decoded.email === ADMIN_FALLBACK.email) {
        return res.json({
          user: {
            id: ADMIN_FALLBACK.id,
            username: ADMIN_FALLBACK.username,
            email: ADMIN_FALLBACK.email,
            avatar: ADMIN_FALLBACK.avatar,
            puntiRankiard: ADMIN_FALLBACK.puntiRankiard,
          },
          guestMode: false,
          fallbackMode: true
        });
      }

      if (isDatabaseAvailable() && db) {
        const tryFetchUser = async () => db.select().from(users).where(eq(users.id, decoded.userId)).limit(1);
        try {
          let [user] = await tryFetchUser();
          // Auto-retry with fallback if 402 quota exceeded
          if (!user && false) { /* placeholder — real retry is in catch */ }

          if (!user) {
            return res.status(404).json({ error: "Utente non trovato" });
          }

          res.json({
            user: {
              id: user.id,
              username: user.username,
              email: user.email,
              avatar: user.avatar,
              puntiRankiard: user.puntiRankiard,
            },
            guestMode: false
          });
        } catch (dbError) {
          if (is402(dbError)) {
            const switched = switchToFallback();
            if (switched) {
              try {
                const [user] = await tryFetchUser();
                if (user) {
                  return res.json({
                    user: { id: user.id, username: user.username, email: user.email, avatar: user.avatar, puntiRankiard: user.puntiRankiard },
                    guestMode: false
                  });
                }
              } catch (_retryErr) { /* fall through */ }
            }
          }
          console.error("Database error in /api/auth/me:", dbError);
          res.json({ user: null, guestMode: true, dbError: true });
        }
      } else {
        const user = jsonStorage.users.getById(decoded.userId);

        if (!user) {
          return res.json({ user: null, guestMode: true, dbError: true });
        }

        res.json({
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            avatar: user.avatar,
            puntiRankiard: user.puntiRankiard,
          },
          guestMode: false
        });
      }
    } catch (error) {
      console.error("Get current user error:", error);
      res.status(500).json({ error: "Errore interno del server" });
    }
  });

  app.put("/api/auth/user/:userId/avatar", authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.userId);
      const { avatar } = req.body;

      if (isNaN(userId)) {
        return res.status(400).json({ error: "ID utente non valido" });
      }

      if (req.user?.userId !== userId) {
        return res.status(403).json({ error: "Accesso non autorizzato" });
      }

      if (!avatar || !VALID_AVATAR_IDS.includes(avatar)) {
        return res.status(400).json({ error: "Avatar non valido" });
      }

      if (isDatabaseAvailable() && db) {
        const [updatedUser] = await db.update(users)
          .set({ avatar })
          .where(eq(users.id, userId))
          .returning();

        emitSync('users', 'update', { avatar, _syncId: userId }, eq(users.id, userId));

        if (!updatedUser) {
          return res.status(404).json({ error: "Utente non trovato" });
        }

        res.json({
          success: true,
          user: {
            id: updatedUser.id,
            username: updatedUser.username,
            avatar: updatedUser.avatar,
          }
        });
      } else {
        const updatedUser = jsonStorage.users.update(userId, { avatar });

        emitSync('users', 'update', { avatar, _syncId: userId }, eq(users.id, userId));

        if (!updatedUser) {
          return res.status(404).json({ error: "Utente non trovato" });
        }

        res.json({
          success: true,
          user: {
            id: updatedUser.id,
            username: updatedUser.username,
            avatar: updatedUser.avatar,
          }
        });
      }
    } catch (error) {
      console.error("Update avatar error:", error);
      res.status(500).json({ error: "Errore nell'aggiornamento avatar" });
    }
  });

  app.post("/api/auth/logout", (_req: Request, res: Response) => {
    res.json({ success: true, message: "Logout effettuato" });
  });

  app.post("/api/auth/forgot-password", async (req: Request, res: Response) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ error: "Email richiesta" });
      }

      const crypto = await import('crypto');
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetExpires = new Date(Date.now() + 3600000);

      let userFound = false;
      let userId: number | undefined;

      if (isDatabaseAvailable() && db) {
        const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
        if (user) {
          userFound = true;
          userId = user.id;
          await db.update(users)
            .set({ resetPasswordToken: resetToken, resetPasswordExpires: resetExpires })
            .where(eq(users.id, user.id));
          emitSync('users', 'update', { resetPasswordToken: resetToken, resetPasswordExpires: resetExpires, _syncId: user.id }, eq(users.id, user.id));
        }
      } else {
        const user = jsonStorage.users.getByEmail(email);
        if (user) {
          userFound = true;
          userId = user.id;
          jsonStorage.users.update(user.id, {
            resetPasswordToken: resetToken,
            resetPasswordExpires: resetExpires.toISOString(),
          });
          emitSync('users', 'update', { resetPasswordToken: resetToken, resetPasswordExpires: resetExpires, _syncId: user.id }, eq(users.id, user.id));
        }
      }

      if (!userFound) {
        return res.json({ success: true, message: "Se l'email esiste nel sistema, riceverai le istruzioni per il recupero password." });
      }

      const protocol = req.get('x-forwarded-proto') || req.protocol || 'https';
      const host = req.get('host') || '';
      const resetUrl = `${protocol}://${host}/?token=${resetToken}`;

      try {
        const { getUncachableResendClient } = await import('./resendClient');
        const { client, fromEmail } = await getUncachableResendClient();
        
        const toAddress = email;
        console.log(`[ForgotPassword] Sending reset email to: ${toAddress} | from: ${fromEmail} | resetUrl: ${resetUrl}`);
        
        const result = await client.emails.send({
          from: fromEmail,
          to: toAddress,
          subject: 'Recupero Password MINKIARDS',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #1a1a2e; color: #ffffff; border-radius: 12px;">
              <h1 style="text-align: center; color: #a78bfa;">Recupero Password MINKIARDS</h1>
              <p>Hai richiesto il recupero della password per il tuo account.</p>
              <p>Clicca sul pulsante qui sotto per reimpostare la password:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetUrl}" style="display: inline-block; padding: 14px 32px; background-color: #7c3aed; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">Reimposta Password</a>
              </div>
              <p style="color: #9ca3af; font-size: 14px;">Il link scadra tra 1 ora.</p>
              <p style="color: #9ca3af; font-size: 14px;">Se non hai richiesto il recupero password, ignora questa email.</p>
              <hr style="border-color: #374151; margin: 20px 0;" />
              <p style="color: #6b7280; font-size: 12px; text-align: center;">MINKIARDS - Il gioco di carte</p>
            </div>
          `
        });

        if (result.error) {
          const errDetail = JSON.stringify(result.error);
          console.error(`[ForgotPassword] Resend API error for ${toAddress}:`, errDetail);
          if (errDetail.includes('domain') || errDetail.includes('verified') || errDetail.includes('authorized')) {
            console.error('[ForgotPassword] HINT: The "from" domain is not verified in Resend. Set RESEND_FROM_EMAIL to an address on a domain you own and have verified at resend.com/domains');
          }
          throw new Error(result.error.message || 'Email send failed');
        }

        console.log(`[ForgotPassword] ✅ Email sent successfully to: ${toAddress} | Resend ID: ${result.data?.id}`);
        
        res.json({ 
          success: true, 
          emailSent: true,
          message: "Email di recupero inviata! Controlla la tua casella di posta (anche lo spam)."
        });
      } catch (emailError: any) {
        console.error("Error sending reset email:", emailError?.message || emailError);
        
        res.status(500).json({ 
          success: false, 
          emailSent: false,
          error: "Impossibile inviare l'email di recupero. Riprova tra qualche minuto o contatta l'assistenza."
        });
      }
    } catch (error) {
      console.error("Forgot password error:", error);
      res.status(500).json({ error: "Errore durante il recupero password" });
    }
  });

  app.post("/api/auth/reset-password", async (req: Request, res: Response) => {
    try {
      const { token, newPassword } = req.body;
      
      if (!token || !newPassword) {
        return res.status(400).json({ error: "Token e nuova password richiesti" });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ error: "La password deve essere di almeno 6 caratteri" });
      }

      if (isDatabaseAvailable() && db) {
        const [user] = await db.select().from(users)
          .where(eq(users.resetPasswordToken, token))
          .limit(1);

        if (!user) {
          return res.status(400).json({ error: "Token non valido o scaduto" });
        }

        if (user.resetPasswordExpires && user.resetPasswordExpires < new Date()) {
          return res.status(400).json({ error: "Token scaduto, richiedi un nuovo recupero password" });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        await db.update(users)
          .set({ 
            password: hashedPassword,
            resetPasswordToken: null,
            resetPasswordExpires: null
          })
          .where(eq(users.id, user.id));

        emitSync('users', 'update', { password: hashedPassword, resetPasswordToken: null, resetPasswordExpires: null, _syncId: user.id }, eq(users.id, user.id));

        res.json({ success: true, message: "Password reimpostata con successo" });
      } else {
        const user = jsonStorage.users.getByResetToken(token);

        if (!user) {
          return res.status(400).json({ error: "Token non valido o scaduto" });
        }

        if (user.resetPasswordExpires && new Date(user.resetPasswordExpires) < new Date()) {
          return res.status(400).json({ error: "Token scaduto, richiedi un nuovo recupero password" });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        jsonStorage.users.update(user.id, {
          password: hashedPassword,
          resetPasswordToken: null,
          resetPasswordExpires: null,
        });

        emitSync('users', 'update', { password: hashedPassword, resetPasswordToken: null, resetPasswordExpires: null, _syncId: user.id }, eq(users.id, user.id));

        res.json({ success: true, message: "Password reimpostata con successo" });
      }
    } catch (error) {
      console.error("Reset password error:", error);
      res.status(500).json({ error: "Errore durante il reset della password" });
    }
  });
}
