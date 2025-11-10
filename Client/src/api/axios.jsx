
import axios from "axios";

const API_URL="http://192.168.1.23:8080"
export default axios.create({
  baseURL: API_URL
  }
)