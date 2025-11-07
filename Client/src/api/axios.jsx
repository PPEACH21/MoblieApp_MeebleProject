
import axios from "axios";

const API_URL="http://10.130.198.204:8080"
export default axios.create({
  baseURL: API_URL
  }
)