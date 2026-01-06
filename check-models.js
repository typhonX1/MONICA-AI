// check-models.js
// Replace with your actual API Key from firebaseConfig.ts or the one you use
const API_KEY = "AIzaSyClrvbDPGjA6-ke6zy3NO7v3FADly-PR2I"; 

async function listModels() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.error) {
      console.error("Error:", data.error.message);
      return;
    }

    console.log("\n✅ AVAILABLE MODELS FOR YOUR KEY:");
    console.log("-----------------------------------");
    data.models.forEach(model => {
      // Only show models that support text generation (chat)
      if (model.supportedGenerationMethods.includes("generateContent")) {
        console.log(`ID: ${model.name.replace("models/", "")}`);
        console.log(`    Name: ${model.displayName}`);
      }
    });
    console.log("-----------------------------------\n");
    
  } catch (e) {
    console.error("Network Error:", e);
  }
}

listModels();