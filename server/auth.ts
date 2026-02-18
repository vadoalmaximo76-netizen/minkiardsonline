import { Express, Request, Response, NextFunction } from "express";
import { db, isDatabaseAvailable } from "./db";
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

        const [newUser] = await db.insert(users).values({
          username,
          email,
          password: hashedPassword,
          avatar: validAvatar,
        }).returning();

        emitSync('users', 'insert', { username, email, password: hashedPassword, avatar: validAvatar });

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
      } else {
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
      }
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
          const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

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
        } catch (dbError) {
          console.error("Database error during login, trying fallback:", dbError);
          
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
        try {
          const [user] = await db.select().from(users).where(eq(users.id, decoded.userId)).limit(1);

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

      if (isDatabaseAvailable() && db) {
        const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
        
        if (!user) {
          return res.json({ success: true, message: "Se l'email esiste, riceverai le istruzioni per il recupero password" });
        }

        const crypto = await import('crypto');
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetExpires = new Date(Date.now() + 3600000);

        await db.update(users)
          .set({ 
            resetPasswordToken: resetToken,
            resetPasswordExpires: resetExpires
          })
          .where(eq(users.id, user.id));

        emitSync('users', 'update', { resetPasswordToken: resetToken, resetPasswordExpires: resetExpires, _syncId: user.id }, eq(users.id, user.id));

        try {
          const { getUncachableResendClient } = await import('./resendClient');
          const { client, fromEmail } = await getUncachableResendClient();
          
          const resetUrl = `${req.protocol}://${req.get('host')}/?token=${resetToken}`;
          
          await client.emails.send({
            from: fromEmail || 'MINKIARDS <onboarding@resend.dev>',
            to: email,
            subject: 'Recupero Password MINKIARDS',
            html: `
              <h1>Recupero Password</h1>
              <p>Hai richiesto il recupero della password per il tuo account MINKIARDS.</p>
              <p>Clicca sul link seguente per reimpostare la password:</p>
              <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #7c3aed; color: white; text-decoration: none; border-radius: 6px;">Reimposta Password</a>
              <p>Il link scadrà tra 1 ora.</p>
              <p>Se non hai richiesto il recupero password, ignora questa email.</p>
            `
          });
          console.log("Password reset email sent to:", email);
        } catch (emailError) {
          console.error("Error sending reset email:", emailError);
        }

        res.json({ 
          success: true, 
          message: "Se l'email esiste, riceverai le istruzioni per il recupero password"
        });
      } else {
        const user = jsonStorage.users.getByEmail(email);
        
        if (!user) {
          return res.json({ success: true, message: "Se l'email esiste, riceverai le istruzioni per il recupero password" });
        }

        const crypto = await import('crypto');
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetExpires = new Date(Date.now() + 3600000).toISOString();

        jsonStorage.users.update(user.id, {
          resetPasswordToken: resetToken,
          resetPasswordExpires: resetExpires,
        });

        emitSync('users', 'update', { resetPasswordToken: resetToken, resetPasswordExpires: resetExpires, _syncId: user.id }, eq(users.id, user.id));

        try {
          const { getUncachableResendClient } = await import('./resendClient');
          const { client, fromEmail } = await getUncachableResendClient();
          
          const resetUrl = `${req.protocol}://${req.get('host')}/?token=${resetToken}`;
          
          await client.emails.send({
            from: fromEmail || 'MINKIARDS <onboarding@resend.dev>',
            to: email,
            subject: 'Recupero Password MINKIARDS',
            html: `
              <h1>Recupero Password</h1>
              <p>Hai richiesto il recupero della password per il tuo account MINKIARDS.</p>
              <p>Clicca sul link seguente per reimpostare la password:</p>
              <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #7c3aed; color: white; text-decoration: none; border-radius: 6px;">Reimposta Password</a>
              <p>Il link scadrà tra 1 ora.</p>
              <p>Se non hai richiesto il recupero password, ignora questa email.</p>
            `
          });
          console.log("Password reset email sent to:", email);
        } catch (emailError) {
          console.error("Error sending reset email:", emailError);
        }

        res.json({ 
          success: true, 
          message: "Se l'email esiste, riceverai le istruzioni per il recupero password"
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
