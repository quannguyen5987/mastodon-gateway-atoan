import { JwtPayload } from "jsonwebtoken";

interface PaaveToken extends JwtPayload {
    dm: string;
    cId: number;
    sgIds: number[];
    lm: number;
    uId: number;
    rId: number;
    ud: Ud;
    pl: string;
    gt: string;
    appV: string;
    iat: number;
    exp: number;
}

interface Ud {
    username: string;
    id: number;
}

export default PaaveToken;
