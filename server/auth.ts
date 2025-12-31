import { Express, Request, Response, NextFunction } from "express";
import { db } from "./db";
import { users, registerUserSchema, loginUserSchema } from "../shared/schema";
import { eq, or } from "drizzle-orm";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const JWT_SECRET = process.env.JWT_SECRET || "minkiards-secret-key-change-in-production";

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

      const token = generateToken(newUser.id, newUser.email);

      res.json({
        success: true,
        token,
        user: {
          id: newUser.id,
          username: newUser.username,
          email: newUser.email,
          avatar: newUser.avatar,
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
        }
      });
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

      let [user] = await db.select().from(users).where(eq(users.googleId, googleId)).limit(1);

      if (!user && email) {
        const [existingEmailUser] = await db.select().from(users).where(eq(users.email, email)).limit(1);
        
        if (existingEmailUser) {
          [user] = await db.update(users)
            .set({ googleId })
            .where(eq(users.id, existingEmailUser.id))
            .returning();
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
        }
      });
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
        }
      });
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ error: "Errore nel recupero utente" });
    }
  });

  app.get("/api/auth/me", authMiddleware, async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Non autenticato" });
      }

      const [user] = await db.select().from(users).where(eq(users.id, req.user.userId)).limit(1);

      if (!user) {
        return res.status(404).json({ error: "Utente non trovato" });
      }

      res.json({
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          avatar: user.avatar,
        }
      });
    } catch (error) {
      console.error("Get current user error:", error);
      res.status(500).json({ error: "Errore nel recupero utente" });
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

      const [updatedUser] = await db.update(users)
        .set({ avatar })
        .where(eq(users.id, userId))
        .returning();

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
    } catch (error) {
      console.error("Update avatar error:", error);
      res.status(500).json({ error: "Errore nell'aggiornamento avatar" });
    }
  });

  app.post("/api/auth/logout", (_req: Request, res: Response) => {
    res.json({ success: true, message: "Logout effettuato" });
  });
}
