require("dotenv").config();

const { PrismaClient } = require("@prisma/client");

const express = require("express");
const cors = require("cors");

const app = express();
const prisma = new PrismaClient();

app.use(express.json()); //for json parsing
app.use(cors());

app.get("/health", (req, res) => {
  res.json({
    message: "Hi there!",
  });
});

app.get("/", (req, res) => res.send("Node.js on Vercel"));

app.post("/identify", async (req, res) => {
  const email = req.body.email;
  const phoneNumber = req.body.phoneNumber;
  const now = new Date();

  var contacts = await prisma.contact.findMany({
    where: {
      OR: [{ email: email }, { phoneNumber: phoneNumber }],
    },
  });

  var primaryId = null;
  var linkedId = null;
  var linkPrecedence = null;

  if (contacts.length == 0) {
    linkPrecedence = "primary";
  } else {
    var isPrimary = false;
    var primaryContact = null;
    linkPrecedence = "secondary";
    var primaryCount = 0;

    //elegant way would be to query the db again, but would cost, hence using the earlier query result only.
    contacts.map((contact, id) => {
      if (contact.linkPrecedence == "primary") {
        isPrimary = true;
        primaryCount++;

        if (!primaryContact || contact.createdAt <= primaryContact.createdAt) {
          primaryContact = contact;
        }
      }
    });

    if (isPrimary) {
      //taking linkedId as id of the primary contact.
      linkedId = primaryContact.id;
      primaryId = primaryContact.id;

      if (primaryCount > 1) {
        contacts = contacts.filter(
          (contact) => contact.id != primaryContact.id
        );
        updateContacts(contacts, linkedId);

        const response = await generateResponse(primaryId);

        return res.json(response);
      }
    } else {
      /*meaning all are secondary contact, so can take linkedId of 
        any of the contact to get the id of primary contact.  */
      primaryId = contacts[0].linkedId;
      linkedId = contacts[0].linkedId;
    }
  }

  const newContact = await createContact(
    email,
    phoneNumber,
    linkedId,
    linkPrecedence,
    now
  );

  if (!primaryId) {
    primaryId = newContact.id;
  }

  const response = await generateResponse(primaryId);

  return res.json(response);
});

const createContact = async (
  email,
  phoneNumber,
  linkedId,
  linkPrecedence,
  now
) => {
  const newContact = await prisma.contact.create({
    data: {
      email: email,
      phoneNumber: phoneNumber,
      linkedId: linkedId,
      linkPrecedence: linkPrecedence,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    },
  });

  return newContact;
};

const updateContacts = async (contacts, linkedId) => {
  for (var i = 0; i < contacts.length; i++) {
    const now = new Date();
    var contact = contacts[i];

    await prisma.contact.update({
      where: { id: contact.id },
      data: {
        email: contact.email,
        phoneNumber: contact.phoneNumber,
        linkedId: linkedId,
        linkPrecedence: "secondary",
        createdAt: contact.createdAt,
        updatedAt: now,
        deletedAt: null,
      },
    });
  }

  return;
};

const generateResponse = async (primaryId) => {
  var contacts = await prisma.contact.findMany({
    where: {
      OR: [{ id: primaryId }, { linkedId: primaryId }],
    },
    select: {
      email: true,
      phoneNumber: true,
      id: true,
    },
  });

  const primaryContact = contacts.find((contact) => contact.id === primaryId);

  contacts = contacts.filter((contact) => contact.id != primaryId);

  const emails = [];
  const phoneNumbers = [];
  const secondaryContactIds = [];

  //primary contact email, number noot coming, check

  if (primaryContact.email && !emails.includes(primaryContact.email)) {
    emails.push(primaryContact.email);
  }

  if (
    primaryContact.phoneNumber &&
    !phoneNumbers.includes(primaryContact.phoneNumber)
  ) {
    phoneNumbers.push(primaryContact.phoneNumber);
  }

  for (var i = 0; i < contacts.length; i++) {
    const contact = contacts[i];

    //check for already existing values
    if (contact.email && !emails.includes(contact.email)) {
      emails.push(contact.email);
    }

    if (contact.phoneNumber && !phoneNumbers.includes(contact.phoneNumber)) {
      phoneNumbers.push(contact.phoneNumber);
    }

    secondaryContactIds.push(contact.id);
  }

  const obj = new Object({
    contact: {
      primaryContatctId: primaryId,
      emails: emails,
      phoneNumbers: phoneNumbers,
      secondaryContactIds: secondaryContactIds,
    },
  });

  return obj;
};

app.listen(3000);

process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

module.exports = app;
