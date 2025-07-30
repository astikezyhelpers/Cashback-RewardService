import 'dotenv/config'
import { app } from "./app.js";

const PORT = process.env.PORT || 3009;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`); 
})