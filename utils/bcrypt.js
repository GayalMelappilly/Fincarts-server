import bcrypt from 'bcrypt'
import { configDotenv } from "dotenv";
configDotenv();

export const hashPassword = async (password) => {
    const saltRounds = Number(process.env.SALT_ROUNDS)
    return bcrypt.hash(password, saltRounds)
}

export const matchPassword = async (password, hashedPassword) => {

    const isMatch = await bcrypt.compare(password, hashedPassword)

    if(isMatch){
        return true
    }else{
        return false
    }

}
 
