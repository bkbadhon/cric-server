const express = require("express");
const cors = require("cors");
const app = express();
require('dotenv').config()
const axios = require("axios");
const Port = 5000;

const corsOptions = {
    origin: ['http://localhost:5173'],
    credentials: true, 
  };
  

 

app.use(express.json());
app.use(cors(corsOptions));

const API_KEY = 'ed39bb28-d0b2-48d5-9347-a1d82a3300fb';

app.get("/live-scores", async (req, res) => {
    try {
        const response = await axios.get(`https://api.cricapi.com/v1/currentMatches`, {
            params: { apikey: API_KEY }
        });
        res.json(response.data);
    } catch (error) {
        console.error("Error fetching live scores:", error);
        res.status(500).send("Error fetching live scores");
    }
});


app.get("/", async (req, res) => {
    res.send({ message: "Welcome to our server" });
});

app.listen(Port, () => {
    console.log(`Server is running at ${Port}`);
});